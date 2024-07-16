import {
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_kms as kms,
  aws_logs as logs,
  aws_rds as rds,
  aws_sns as sns,
  aws_ec2 as ec2,
  Duration,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface DatastoreProps {
  vpc: ec2.IVpc;
  cmk: kms.IKey;
  alarmTopic: sns.ITopic;
}

export class Datastore extends Construct {
  public readonly dbCluster: IDatabaseCluster;

  constructor(scope: Construct, id: string, props: DatastoreProps) {
    super(scope, id);

    // Create RDS MySQL Instance
    const cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      // for Aurora PostgreSQL
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_11_9,
      }),
      // for Aurora MySQL
      // engine: rds.DatabaseClusterEngine.auroraMysql({
      //   version: rds.AuroraMysqlEngineVersion.VER_2_09_1
      // }),
      credentials: rds.Credentials.fromGeneratedSecret('dbadmin'),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      vpc: props.vpc,
      writer: rds.ClusterInstance.provisioned('Instance1', {
        instanceIdentifier: 'Datastore1',
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
        enablePerformanceInsights: true,
        performanceInsightEncryptionKey: props.cmk,
        performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // 7 days
        isFromLegacyInstanceProps: true,
      }),
      readers: [
        rds.ClusterInstance.provisioned('Instance2', {
          instanceIdentifier: 'Datastore2',
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
          enablePerformanceInsights: true,
          performanceInsightEncryptionKey: props.cmk,
          performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // 7 days
          isFromLegacyInstanceProps: true,
        }),
      ],
      removalPolicy: RemovalPolicy.SNAPSHOT,
      defaultDatabaseName: 'mydb',
      storageEncrypted: true,
      storageEncryptionKey: props.cmk,
      //      cloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit'],  // For Aurora MySQL
      cloudwatchLogsExports: ['postgresql'], // For Aurora PostgreSQL
      cloudwatchLogsRetention: logs.RetentionDays.THREE_MONTHS,
      instanceIdentifierBase: id,
    });
    this.dbCluster = cluster;

    // ----------------------- Alarms for RDS -----------------------------

    // Aurora Cluster CPU Utilization
    cluster
      .metricCPUUtilization({
        period: Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'AuroraCPUUtilAlarm', {
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        threshold: 90,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Can't find instanceIdentifiers - implement later
    //
    // cluster.instanceIdentifiers.forEach(instance => {
    //   console.log("instance: "+instance);
    //   new cw.Metric({
    //     metricName: 'CPUUtilization',
    //     namespace: 'AWS/RDS',
    //      dimensionsMap: {
    //       DBInstanceIdentifier: instance
    //     },
    //     period: cdk.Duration.minutes(1),
    //     statistic: cw.Stats.AVERAGE,
    //   }).createAlarm(this, 'CPUUtilization', {
    //     evaluationPeriods: 3,
    //     datapointsToAlarm: 2,
    //     threshold: 90,
    //     comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
    //     actionsEnabled: true
    //   }).addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
    // });

    // ----------------------- RDS Event Subscription  -----------------------------
    //   Send critical(see eventCategories) event on all of clusters and instances
    //
    // See: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-rds-eventsubscription.html
    // See: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_Events.html
    //
    // To specify clusters or instances, add "sourceType (sting)" and "sourceIds (list)"
    // sourceType is one of these - db-instance | db-cluster | db-parameter-group | db-security-group | db-snapshot | db-cluster-snapshot
    //
    new rds.CfnEventSubscription(this, 'RdsClusterEventSubsc', {
      snsTopicArn: props.alarmTopic.topicArn,
      enabled: true,
      sourceType: 'db-cluster',
      eventCategories: ['failure', 'failover', 'maintenance'],
    });

    new rds.CfnEventSubscription(this, 'RdsInstanceEventSubsc', {
      snsTopicArn: props.alarmTopic.topicArn,
      enabled: true,
      sourceType: 'db-instance',
      eventCategories: [
        'availability',
        'configuration change',
        'deletion',
        'failover',
        'failure',
        'maintenance',
        'notification',
        'recovery',
      ],
    });
  }
}
