import {
  aws_chatbot as chatbot,
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_iam as iam,
  aws_sns as sns,
  Names,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface MonitoringProps {
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  fileSystemId: string;
}

export class Monitoring extends Construct {
  public readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    // SNS Topic for monitoring alarms
    const topic = new sns.Topic(this, 'AlarmTopic');

    // Allow CloudWatch to publish to SNS
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );
    this.alarmTopic = topic;

    // Email subscription (skip if empty)
    if (props.monitoringNotifyEmail) {
      new sns.Subscription(this, 'EmailSubscription', {
        topic,
        protocol: sns.SubscriptionProtocol.EMAIL,
        endpoint: props.monitoringNotifyEmail,
      });
    }

    // AWS Chatbot Slack integration (skip if params empty)
    if (props.monitoringSlackWorkspaceId && props.monitoringSlackChannelId) {
      const chatbotRole = new iam.Role(this, 'ChatbotRole', {
        assumedBy: new iam.ServicePrincipal('chatbot.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess'),
        ],
      });

      new chatbot.CfnSlackChannelConfiguration(this, 'ChatbotChannel', {
        configurationName: Names.uniqueResourceName(this, {}),
        slackChannelId: props.monitoringSlackChannelId,
        iamRoleArn: chatbotRole.roleArn,
        slackWorkspaceId: props.monitoringSlackWorkspaceId,
        snsTopicArns: [topic.topicArn],
      });
    }

    // CloudWatch Alarm: Throughput utilization
    const throughputAlarm = new cw.Alarm(this, 'ThroughputUtilizationAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'FileServerDiskThroughputUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription:
        'FSxN throughput utilization exceeds 80%. NFS/SMB and S3 AP share this throughput.',
    });
    throughputAlarm.addAlarmAction(new cw_actions.SnsAction(topic));

    // CloudWatch Alarm: CPU utilization
    const cpuAlarm = new cw.Alarm(this, 'CpuUtilizationAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'CPUUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'FSxN CPU utilization exceeds 80%.',
    });
    cpuAlarm.addAlarmAction(new cw_actions.SnsAction(topic));

    // CloudWatch Alarm: Storage capacity utilization
    const storageAlarm = new cw.Alarm(this, 'StorageCapacityAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'StorageCapacityUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'FSxN storage capacity utilization exceeds 80%.',
    });
    storageAlarm.addAlarmAction(new cw_actions.SnsAction(topic));
  }
}

// Required for Duration import
import * as cdk from 'aws-cdk-lib';
