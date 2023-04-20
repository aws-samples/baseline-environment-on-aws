import * as cdk from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_config as config } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cwa } from 'aws-cdk-lib';
import { aws_events as cwe } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_events_targets as cwet } from 'aws-cdk-lib';
import { ITopic } from 'aws-cdk-lib/aws-sns';

export interface DetectionProps {
  notifyEmail: string;
  cloudTrailLogGroupName: string;
}

export class Detection extends Construct {
  public readonly topic: ITopic;

  constructor(scope: Construct, id: string, props: DetectionProps) {
    super(scope, id);

    // === AWS Config Rules ===
    // ConfigRule for Default Security Group is closed  (Same as SecurityHub - need this for auto remediation)
    //
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-4.3
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html
    const defaultSgClosedRule = new config.ManagedRule(this, 'DefaultSgClosedRule', {
      identifier: config.ManagedRuleIdentifiers.VPC_DEFAULT_SECURITY_GROUP_CLOSED,
      ruleScope: config.RuleScope.fromResources([config.ResourceType.EC2_SECURITY_GROUP]),
      configRuleName: 'bb-default-security-group-closed',
      description:
        'Checks that the default security group of any Amazon Virtual Private Cloud (VPC) does not allow inbound or outbound traffic. The rule is non-compliant if the default security group has one or more inbound or outbound traffic.',
    });

    // Role for auto remediation
    const defaultSgRemediationRole = new iam.Role(this, 'DefaultSgRemediationRole', {
      assumedBy: new iam.ServicePrincipal('ssm.amazonaws.com'),
      path: '/',
      managedPolicies: [{ managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonSSMAutomationRole' }],
    });
    defaultSgRemediationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ec2:RevokeSecurityGroupIngress', 'ec2:RevokeSecurityGroupEgress', 'ec2:DescribeSecurityGroups'],
        resources: ['*'],
      }),
    );
    defaultSgRemediationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: [defaultSgRemediationRole.roleArn],
      }),
    );
    defaultSgRemediationRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:StartAutomationExecution'],
        resources: ['arn:aws:ssm:::automation-definition/AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules'],
      }),
    );

    // Remediation for Remove VPC Default SecurityGroup Rules  by  SSM Automation
    new config.CfnRemediationConfiguration(this, 'DefaultSgRemediation', {
      configRuleName: defaultSgClosedRule.configRuleName,
      targetType: 'SSM_DOCUMENT',
      targetId: 'AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules',
      targetVersion: '1',
      parameters: {
        AutomationAssumeRole: {
          StaticValue: {
            Values: [defaultSgRemediationRole.roleArn],
          },
        },
        GroupId: {
          ResourceValue: {
            Value: 'RESOURCE_ID',
          },
        },
      },
      automatic: true,
      maximumAutomaticAttempts: 5,
      retryAttemptSeconds: 60,
    });

    // SNS Topic for Security Alarm
    const topic = new sns.Topic(this, 'AlarmTopic');
    new sns.Subscription(this, 'SecurityAlarmEmail', {
      endpoint: props.notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: topic,
    });
    cdk.Stack.of(this).exportValue(topic.topicArn);
    this.topic = topic;

    // Allow to publish message from CloudWatch
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );

    // --------------- ConfigRule Compliance Change Notification -----------------
    // ConfigRule - Compliance Change
    //  See: https://docs.aws.amazon.com/config/latest/developerguide/monitor-config-with-cloudwatchevents.html
    //  See: https://aws.amazon.com/premiumsupport/knowledge-center/config-resource-non-compliant/?nc1=h_ls
    //  If you want to add rules to notify, add rule name text string to "configRuleName" array.
    //  Sample Rule 'bb-default-security-group-closed' is defined at lib/blea-config-rules-stack.ts
    new cwe.Rule(this, 'DefaultSgClosedEventRule', {
      description: 'CloudWatch Event Rule to send notification on Config Rule compliance changes.',
      enabled: true,
      eventPattern: {
        source: ['aws.config'],
        detailType: ['Config Rules Compliance Change'],
        detail: {
          configRuleName: ['bb-default-security-group-closed'],
          newEvaluationResult: {
            complianceType: ['NON_COMPLIANT'],
          },
        },
      },
      targets: [new cwet.SnsTopic(topic)],
    });

    // ------------------------ AWS Health Notification ---------------------------

    // AWS Health - Notify any events on AWS Health
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/cloudwatch-notification-scheduled-events/?nc1=h_ls
    new cwe.Rule(this, 'AwsHealthEventRule', {
      description: 'Notify AWS Health event',
      enabled: true,
      eventPattern: {
        source: ['aws.health'],
        detailType: ['AWS Health Event'],
      },
      targets: [new cwet.SnsTopic(topic)],
    });

    // ------------ Detective guardrails from NIST standard template ----------------
    // See: https://aws.amazon.com/blogs/publicsector/automating-compliance-architecting-for-fedramp-high-and-nist-workloads-in-aws-govcloud-us/

    // Security Groups Change Notification
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/monitor-security-group-changes-ec2/?nc1=h_ls
    //  from NIST template
    new cwe.Rule(this, 'SgChangedEventRule', {
      description: 'Notify to create, update or delete a Security Group.',
      enabled: true,
      eventPattern: {
        source: ['aws.ec2'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['ec2.amazonaws.com'],
          eventName: [
            'AuthorizeSecurityGroupIngress',
            'AuthorizeSecurityGroupEgress',
            'RevokeSecurityGroupIngress',
            'RevokeSecurityGroupEgress',
          ],
        },
      },
      targets: [new cwet.SnsTopic(topic)],
    });

    // Network ACL Change Notification
    //  from NIST template
    new cwe.Rule(this, 'NetworkAclChangeEventRule', {
      description: 'Notify to create, update or delete a Network ACL.',
      enabled: true,
      eventPattern: {
        source: ['aws.ec2'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['ec2.amazonaws.com'],
          eventName: [
            'CreateNetworkAcl',
            'CreateNetworkAclEntry',
            'DeleteNetworkAcl',
            'DeleteNetworkAclEntry',
            'ReplaceNetworkAclEntry',
            'ReplaceNetworkAclAssociation',
          ],
        },
      },
      targets: [new cwet.SnsTopic(topic)],
    });

    // CloudTrail Change
    //  from NIST template
    new cwe.Rule(this, 'CloudTrailChangeEventRule', {
      description: 'Notify to change on CloudTrail log configuration',
      enabled: true,
      eventPattern: {
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['cloudtrail.amazonaws.com'],
          eventName: ['StopLogging', 'DeleteTrail', 'UpdateTrail'],
        },
      },
      targets: [new cwet.SnsTopic(topic)],
    });

    // LogGroup Construct for CloudTrail
    //   Use LogGroup.fromLogGroupName() because...
    //   On Control Tower environment, it created by not BLEA but Control Tower. So we need to refer existent LogGroup.
    //   When you use BLEA Standalone version, the LogGroup is created by BLEA.
    //
    //   Note:
    //     MetricFilter-based detection may delay for several minutes because of latency on CloudTrail Log delivery to CloudWatchLogs
    //     Use CloudWatch Events if you can, it deliver CloudTrail event faster.
    //     IAM event occur in us-east-1 region so if you want to detect it, you need to use MetrifFilter-based detection
    //     See: https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-event-reference-aws-console-sign-in-events.html
    //
    const cloudTrailLogGroup = cwl.LogGroup.fromLogGroupName(this, 'CloudTrailLogGroup', props.cloudTrailLogGroupName);

    // IAM Policy Change Notification
    //  from NIST template
    const mfIAMPolicyChange = new cwl.MetricFilter(this, 'IAMPolicyChangeFilter', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString:
          '{($.eventName=DeleteGroupPolicy)||($.eventName=DeleteRolePolicy)||($.eventName=DeleteUserPolicy)||($.eventName=PutGroupPolicy)||($.eventName=PutRolePolicy)||($.eventName=PutUserPolicy)||($.eventName=CreatePolicy)||($.eventName=DeletePolicy)||($.eventName=CreatePolicyVersion)||($.eventName=DeletePolicyVersion)||($.eventName=AttachRolePolicy)||($.eventName=DetachRolePolicy)||($.eventName=AttachUserPolicy)||($.eventName=DetachUserPolicy)||($.eventName=AttachGroupPolicy)||($.eventName=DetachGroupPolicy)}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'IAMPolicyEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'IAMPolicyChangeAlarm', {
      metric: mfIAMPolicyChange.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Stats.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'IAM Configuration changes detected!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(topic));

    // Unauthorized Attempts
    //  from NIST template
    const unauthorizedAttemptsFilter = new cwl.MetricFilter(this, 'UnauthorizedAttemptsFilter', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        // Exclude calls “Decrypt" event by config.amazonaws.com to ignore innocuous errors caused by AWS Config.
        // That error occurs if you have KMS (CMK) encrypted environment variables in Lambda function.
        logPatternString:
          '{($.errorCode = "*UnauthorizedOperation" || $.errorCode = "AccessDenied*") && ($.eventName != "Decrypt" || $.userIdentity.invokedBy != "config.amazonaws.com" )}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'UnauthorizedAttemptsEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'UnauthorizedAttemptsAlarm', {
      metric: unauthorizedAttemptsFilter.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Stats.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 5,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Multiple unauthorized actions or logins attempted!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(topic));

    // NewAccessKeyCreated
    //  from NIST template
    const newAccessKeyCreatedFilter = new cwl.MetricFilter(this, 'NewAccessKeyCreatedFilter', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString: '{($.eventName=CreateAccessKey)}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'NewAccessKeyCreatedEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'NewAccessKeyCreatedAlarm', {
      metric: newAccessKeyCreatedFilter.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Stats.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Warning: New IAM access Eey was created. Please be sure this action was neccessary.',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(topic));

    // Detect Root Activity from CloudTrail Log (For SecurityHub CIS 1.1)
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-standards-cis-controls-1.1
    // See: https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudwatch-alarms-for-cloudtrail-additional-examples.html
    const rootUserActivityFilter = new cwl.MetricFilter(this, 'RootUserActivityFilter', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString:
          '{$.userIdentity.type="Root" && $.userIdentity.invokedBy NOT EXISTS && $.eventType !="AwsServiceEvent"}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'RootUserPolicyEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'RootUserActivityAlarm', {
      metric: rootUserActivityFilter.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Stats.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Root user activity detected!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(topic));

    // ------------------- Other security services integration ----------------------

    // SecurityHub - Imported
    //   Security Hub automatically sends all new findings and all updates to existing findings to EventBridge as Security Hub Findings - Imported events.
    //   See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cwe-integration-types.html
    //
    //   Security Hub Finding format
    //   See: https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-findings-format.html
    new cwe.Rule(this, 'SecurityHubEventRule', {
      description: 'CloudWatch Event Rule to send notification on SecurityHub all new findings and all updates.',
      enabled: true,
      eventPattern: {
        source: ['aws.securityhub'],
        detailType: ['Security Hub Findings - Imported'],
        detail: {
          findings: {
            Severity: {
              Label: ['CRITICAL', 'HIGH'],
            },
            Compliance: {
              Status: ['FAILED'],
            },
            Workflow: {
              Status: ['NEW', 'NOTIFIED'],
            },
            RecordState: ['ACTIVE'],
          },
        },
      },
      targets: [new cwet.SnsTopic(topic)],
    });

    // GuardDutyFindings
    //   Will alert for any Medium to High finding.
    //   See: https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_findings_cloudwatch.html
    new cwe.Rule(this, 'GuardDutyEventRule', {
      description: 'CloudWatch Event Rule to send notification on GuardDuty findings.',
      enabled: true,
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: ['GuardDuty Finding'],
        detail: {
          severity: [
            4, 4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5, 5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6,
            6.0, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7, 7.0, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8,
            8.0, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9,
          ],
        },
      },
      targets: [new cwet.SnsTopic(topic)],
    });
  }
}
