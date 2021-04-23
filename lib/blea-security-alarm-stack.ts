import * as cdk from '@aws-cdk/core';
import * as sns from '@aws-cdk/aws-sns';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cwa from '@aws-cdk/aws-cloudwatch-actions';
import * as cwe from '@aws-cdk/aws-events';
import * as cwet from '@aws-cdk/aws-events-targets';

interface BLEASecurityAlarmStackProps extends cdk.StackProps {
  notifyEmail: string;
}

export class BLEASecurityAlarmStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: cdk.Construct, id: string, props: BLEASecurityAlarmStackProps) {
    super(scope, id, props);

    // SNS Topic for Security Alarm
    const secTopic = new sns.Topic(this, 'SecurityAlarmTopic');
    new sns.Subscription(this, 'SecurityAlarmEmail', {
      endpoint: props.notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: secTopic,
    });
    this.alarmTopic = secTopic;

    // --------------- ConfigRule Compliance Change Notification -----------------
    // ConfigRule - Compliance Change
    //  See: https://docs.aws.amazon.com/config/latest/developerguide/monitor-config-with-cloudwatchevents.html
    //  See: https://aws.amazon.com/premiumsupport/knowledge-center/config-resource-non-compliant/?nc1=h_ls
    new cwe.Rule(this, 'BLEARuleConfigRules', {
      description: 'CloudWatch Event Rule to send notification on Config Rule compliance changes.',
      enabled: true,
      eventPattern: {
        source: ['aws.config'],
        detailType: ['Config Rules Compliance Change'],
        detail: {
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

    // IAM Policy Change Notification
    //  from NIST template
    new cwe.Rule(this, 'BLEAIAMPolicyChange', {
      description: 'Notify to modify IAM Policy',
      enabled: true,
      eventPattern: {
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['iam.amazonaws.com'],
          eventName: [
            'DeleteRolePolicy',
            'DeleteUserPolicy',
            'PutGroupPolicy',
            'PutRolePolicy',
            'PutUserPolicy',
            'CreatePolicy',
            'DeletePolicy',
            'CreatePolicyVersion',
            'DeletePolicyVersion',
            'AttachRolePolicy',
            'DetachRolePolicy',
            'AttachUserPolicy',
            'DetachUserPolicy',
            'AttachGroupPolicy',
            'DetachGroupPolicy',
          ],
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // Root User Activity
    // https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudwatch-alarms-for-cloudtrail-additional-examples.html
    // https://docs.aws.amazon.com/eventbridge/latest/userguide/content-filtering-with-event-patterns.html#filtering-exists-matching
    //  from NIST template
    new cwe.Rule(this, 'BLEARuleRootUserUsed', {
      description: 'Notify to detect root user activity',
      enabled: true,
      eventPattern: {
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          userIdentity: {
            type: ['Root'],
            invokedBy: [{ exists: false }],
          },
          eventType: [{ 'anything-but': 'AwsServiceEvent' }],
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // NewAccessKeyCreated
    //  from NIST template
    new cwe.Rule(this, 'BLEARuleNewAccessKeyCreated', {
      description: 'Notify to create new accessKey',
      enabled: true,
      eventPattern: {
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['iam.amazonaws.com'],
          eventName: ['CreateAccessKey'],
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

    // Detect Root Activity from CloudTrail Log (For SecurityHub CIS 1.1)
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-standards-cis-controls-1.1
    //   Note: Metric parameters (namespace and metricName) are defined in "Trail" Stack.
    new cw.Alarm(this, 'RootUserPolicyEventCountAlarm', {
      metric: new cw.Metric({
        namespace: 'LogMetrics',
        metricName: 'RootUserPolicyEventCount',
        period: cdk.Duration.seconds(300),
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Root user activity detected!',
      actionsEnabled: true,
      statistic: cw.Statistic.SUM,
    }).addAlarmAction(new cwa.SnsAction(secTopic));

    // ------------------- Other security services integration ----------------------

    // SecurityHub - Imported
    //   Security Hub automatically sends all new findings and all updates to existing findings to EventBridge as Security Hub Findings - Imported events.
    //   See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cwe-integration-types.html
    //
    //   Security Hub Finding format
    //   See: https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-findings-format.html
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
            4,
            4.0,
            4.1,
            4.2,
            4.3,
            4.4,
            4.5,
            4.6,
            4.7,
            4.8,
            4.9,
            5,
            5.0,
            5.1,
            5.2,
            5.3,
            5.4,
            5.5,
            5.6,
            5.7,
            5.8,
            5.9,
            6,
            6.0,
            6.1,
            6.2,
            6.3,
            6.4,
            6.5,
            6.6,
            6.7,
            6.8,
            6.9,
            7,
            7.0,
            7.1,
            7.2,
            7.3,
            7.4,
            7.5,
            7.6,
            7.7,
            7.8,
            7.9,
            8,
            8.0,
            8.1,
            8.2,
            8.3,
            8.4,
            8.5,
            8.6,
            8.7,
            8.8,
            8.9,
          ],
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });
  }
}
