import * as cdk from 'aws-cdk-lib';
import {
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_iam as iam,
  aws_sns as sns,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface MonitoringProps {
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  fileSystemId: string;
  capacityAlarmThresholdPercent: number;
}

export class Monitoring extends Construct {
  public readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    const topic = new sns.Topic(this, 'AlarmTopic');
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );
    this.alarmTopic = topic;

    if (props.monitoringNotifyEmail) {
      new sns.Subscription(this, 'Email', {
        topic,
        protocol: sns.SubscriptionProtocol.EMAIL,
        endpoint: props.monitoringNotifyEmail,
      });
    }

    // Alarms
    const throughputAlarm = new cw.Alarm(this, 'ThroughputAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'FileServerDiskThroughputUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription:
        'FSxN throughput > 80%. Shared across NFS/S3AP. Runbook: scale throughput or schedule Glue off-peak.',
    });
    throughputAlarm.addAlarmAction(new cw_actions.SnsAction(topic));

    const storageAlarm = new cw.Alarm(this, 'StorageAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'StorageCapacityUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: props.capacityAlarmThresholdPercent,
      evaluationPeriods: 3,
      alarmDescription: `FSxN storage > ${props.capacityAlarmThresholdPercent}%. Runbook: expand capacity or review FabricPool tiering.`,
    });
    storageAlarm.addAlarmAction(new cw_actions.SnsAction(topic));

    const cpuAlarm = new cw.Alarm(this, 'CpuAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'CPUUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription: 'FSxN CPU > 80%.',
    });
    cpuAlarm.addAlarmAction(new cw_actions.SnsAction(topic));
  }
}
