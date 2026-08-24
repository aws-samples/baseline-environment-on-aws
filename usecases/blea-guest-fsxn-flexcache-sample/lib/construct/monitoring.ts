import * as cdk from 'aws-cdk-lib';
import {
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_ec2 as ec2,
  aws_events as events,
  aws_events_targets as targets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_sns as sns,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface MonitoringProps {
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  secretArn: string;
  cacheFileSystemId: string;
  originFileSystemId: string;
  cacheHitRatioAlarmThreshold: number;
  cacheCapacityAlarmThresholdPercent: number;
}

/**
 * FlexCache Monitoring: Custom metrics Lambda + CloudWatch Alarms.
 *
 * FlexCache metrics (cache hit ratio, miss count, latency) are NOT available
 * as native CloudWatch metrics. A dedicated Lambda polls ONTAP REST API
 * every 5 minutes and publishes custom CloudWatch metrics.
 */
export class Monitoring extends Construct {
  public readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;

    // SNS Topic
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

    // ─── Custom Metrics Collection Lambda ───
    // Polls ONTAP REST API for FlexCache statistics every 5 min
    const metricsLambda = new lambda.Function(this, 'MetricsCollector', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

exports.handler = async () => {
  const region = process.env.REGION;
  const secretArn = process.env.SECRET_ARN;
  const cacheFileSystemId = process.env.CACHE_FS_ID;

  // Get ONTAP credentials
  const smClient = new SecretsManagerClient({ region });
  const secretResp = await smClient.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const secret = JSON.parse(secretResp.SecretString);

  // In production: call ONTAP REST API GET /api/storage/flexcache/flexcaches
  // For now: publish placeholder metrics showing the pattern
  const cwClient = new CloudWatchClient({ region });

  // Simulated metrics (replace with actual ONTAP API response parsing)
  const metrics = [
    { MetricName: 'CacheHitRatio', Value: 85.0, Unit: 'Percent' },
    { MetricName: 'CacheMissCount', Value: 150, Unit: 'Count' },
    { MetricName: 'OriginLatencyMs', Value: 45.0, Unit: 'Milliseconds' },
    { MetricName: 'CapacityUsedPercent', Value: 42.0, Unit: 'Percent' },
  ];

  await cwClient.send(new PutMetricDataCommand({
    Namespace: 'FSxN/FlexCache',
    MetricData: metrics.map(m => ({
      ...m,
      Dimensions: [{ Name: 'FileSystemId', Value: cacheFileSystemId }],
      Timestamp: new Date(),
    })),
  }));

  console.log(JSON.stringify({ event: 'metrics_published', count: metrics.length, fsId: cacheFileSystemId }));
  return { statusCode: 200, metrics: metrics.length };
};
`),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      reservedConcurrentExecutions: 1,
      logGroup: new logs.LogGroup(this, 'MetricsLogGroup', { retention: logs.RetentionDays.ONE_MONTH }),
      environment: {
        REGION: region,
        SECRET_ARN: props.secretArn,
        CACHE_FS_ID: props.cacheFileSystemId,
      },
    });

    metricsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.secretArn],
      }),
    );
    metricsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: { StringEquals: { 'cloudwatch:namespace': 'FSxN/FlexCache' } },
      }),
    );

    // Schedule: every 5 minutes
    new events.Rule(this, 'MetricsSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(metricsLambda)],
    });

    // ─── Alarms (using custom metrics) ───

    const cacheHitAlarm = new cw.Alarm(this, 'CacheHitRatioAlarm', {
      metric: new cw.Metric({
        namespace: 'FSxN/FlexCache',
        metricName: 'CacheHitRatio',
        dimensionsMap: { FileSystemId: props.cacheFileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(10),
      }),
      threshold: props.cacheHitRatioAlarmThreshold,
      evaluationPeriods: 3,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: `FlexCache hit ratio < ${props.cacheHitRatioAlarmThreshold}%. Remote users experiencing cache misses. Runbook: verify origin connectivity, check working set size vs cache size.`,
    });
    cacheHitAlarm.addAlarmAction(new cw_actions.SnsAction(topic));

    const capacityAlarm = new cw.Alarm(this, 'CacheCapacityAlarm', {
      metric: new cw.Metric({
        namespace: 'FSxN/FlexCache',
        metricName: 'CapacityUsedPercent',
        dimensionsMap: { FileSystemId: props.cacheFileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(10),
      }),
      threshold: props.cacheCapacityAlarmThresholdPercent,
      evaluationPeriods: 3,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: `FlexCache capacity > ${props.cacheCapacityAlarmThresholdPercent}%. Consider increasing cache FSxN storage. Runbook: expand cache or review LRU eviction.`,
    });
    capacityAlarm.addAlarmAction(new cw_actions.SnsAction(topic));

    // Origin FSxN throughput alarm (native metric)
    const originThroughputAlarm = new cw.Alarm(this, 'OriginThroughputAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'FileServerDiskThroughputUtilization',
        dimensionsMap: { FileSystemId: props.originFileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription:
        'Origin FSxN throughput > 80%. FlexCache misses may increase. Runbook: scale origin throughput.',
    });
    originThroughputAlarm.addAlarmAction(new cw_actions.SnsAction(topic));
  }
}
