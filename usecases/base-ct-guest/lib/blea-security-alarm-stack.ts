import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cwa } from 'aws-cdk-lib';
import { aws_events as cwe } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_events_targets as cwet } from 'aws-cdk-lib';

interface BLEASecurityAlarmStackProps extends cdk.StackProps {
  notifyEmail: string;
  cloudTrailLogGroupName: string;
}

export class BLEASecurityAlarmStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: BLEASecurityAlarmStackProps) {
    super(scope, id, props);

    // SNS Topic for Security Alarm
    const secTopic = new sns.Topic(this, 'SecurityAlarmTopic');
    new sns.Subscription(this, 'SecurityAlarmEmail', {
      endpoint: props.notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: secTopic,
    });
    this.alarmTopic = secTopic;

    // Allow to publish message from CloudWatch
    secTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [secTopic.topicArn],
      }),
    );

    // --------------- ConfigRule Compliance Change Notification -----------------
    // ConfigRule - Compliance Change
    //  See: https://docs.aws.amazon.com/config/latest/developerguide/monitor-config-with-cloudwatchevents.html
    //  See: https://aws.amazon.com/premiumsupport/knowledge-center/config-resource-non-compliant/?nc1=h_ls
    //  If you want to add rules to notify, add rule name text string to "configRuleName" array.
    //  Sample Rule 'bb-default-security-group-closed' is defined at lib/blea-config-rules-stack.ts
    new cwe.Rule(this, 'BLEARuleConfigRules', {
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
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // ------------------------ AWS Health Notification ---------------------------

    // AWS Health - Notify any events on AWS Health
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/cloudwatch-notification-scheduled-events/?nc1=h_ls
    new cwe.Rule(this, 'BLEARuleAwsHealth', {
      description: 'Notify AWS Health event',
      enabled: true,
      eventPattern: {
        source: ['aws.health'],
        detailType: ['AWS Health Event'],
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // ------------ Detective guardrails from NIST standard template ----------------
    // See: https://aws.amazon.com/blogs/publicsector/automating-compliance-architecting-for-fedramp-high-and-nist-workloads-in-aws-govcloud-us/

    // Security Groups Change Notification
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/monitor-security-group-changes-ec2/?nc1=h_ls
    //  from NIST template
    new cwe.Rule(this, 'BLEARuleSecurityGroupChange', {
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
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // Network ACL Change Notification
    //  from NIST template
    new cwe.Rule(this, 'BLEARuleNetworkAclChange', {
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
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // CloudTrail Change
    //  from NIST template
    new cwe.Rule(this, 'BLEARuleCloudTrailChange', {
      description: 'Notify to change on CloudTrail log configuration',
      enabled: true,
      eventPattern: {
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['cloudtrail.amazonaws.com'],
          eventName: ['StopLogging', 'DeleteTrail', 'UpdateTrail'],
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // LogGroup Construct for CloudTrail
    //   Use LogGroup.fromLogGroupName() because...
    //   On ControlTower environment, it created by not BLEA but ControlTower. So we need to refer existent LogGroup.
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
    const mfIAMPolicyChange = new cwl.MetricFilter(this, 'IAMPolicyChange', {
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
        statistic: cw.Statistic.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'IAM Configuration changes detected!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(secTopic));

    // Unauthorized Attempts
    //  from NIST template
    const mfUnauthorizedAttempts = new cwl.MetricFilter(this, 'UnauthorizedAttempts', {
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
      metric: mfUnauthorizedAttempts.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Statistic.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 5,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Multiple unauthorized actions or logins attempted!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(secTopic));

    // NewAccessKeyCreated
    //  from NIST template
    const mfNewAccessKeyCreated = new cwl.MetricFilter(this, 'NewAccessKeyCreated', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString: '{($.eventName=CreateAccessKey)}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'NewAccessKeyCreatedEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'NewAccessKeyCreatedAlarm', {
      metric: mfNewAccessKeyCreated.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Statistic.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Warning: New IAM access Eey was created. Please be sure this action was neccessary.',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(secTopic));

    // Detect Root Activity from CloudTrail Log (For SecurityHub CIS 1.1)
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-standards-cis-controls-1.1
    // See: https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudwatch-alarms-for-cloudtrail-additional-examples.html
    const mfRooUserPolicy = new cwl.MetricFilter(this, 'RootUserPolicyEventCount', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString:
          '{$.userIdentity.type="Root" && $.userIdentity.invokedBy NOT EXISTS && $.eventType !="AwsServiceEvent"}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'RootUserPolicyEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'RootUserPolicyEventCountAlarm', {
      metric: mfRooUserPolicy.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Statistic.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Root user activity detected!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(secTopic));

    // ------------------- Other security services integration ----------------------

    // SecurityHub - Imported
    //   Security Hub automatically sends all new findings and all updates to existing findings to EventBridge as Security Hub Findings - Imported events.
    //   See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cwe-integration-types.html
    //
    //   Security Hub Finding format
    //   See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-findings-format.html
    new cwe.Rule(this, 'BLEARuleSecurityHub', {
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
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // GuardDutyFindings
    //   Will alert for any Medium to High finding.
    //   See: https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_findings_cloudwatch.html
    new cwe.Rule(this, 'BLEARuleGuardDuty', {
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
      targets: [new cwet.SnsTopic(secTopic)],
    });
  }
}
