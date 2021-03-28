import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as sns from '@aws-cdk/aws-sns';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cw_actions from '@aws-cdk/aws-cloudwatch-actions';

export interface ABLEDbAuroraPgStackProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  dbName: string;
  dbUser: string;
  dbAllocatedStorage: number;
  appKey: kms.IKey;
  vpcSubnets: ec2.SubnetSelection;
  appServerSecurityGroup: ec2.SecurityGroup;
  alarmTopic: sns.Topic;
}

export class ABLEDbAuroraPgStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ABLEDbAuroraPgStackProps) {
    super(scope, id, props);

    // Create RDS MySQL Instance
    const cluster = new rds.DatabaseCluster(this, 'Aurora', {
      // for Aurora PostgreSQL
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_11_9,
      }),
      // for Aurora MySQL
      // engine: rds.DatabaseClusterEngine.auroraMysql({
      //   version: rds.AuroraMysqlEngineVersion.VER_2_09_1
      // }),
      credentials: rds.Credentials.fromGeneratedSecret(props.dbUser),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
        vpcSubnets: props.vpcSubnets,
        vpc: props.myVpc,
        enablePerformanceInsights: true,
        performanceInsightEncryptionKey: props.appKey,
        performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // 7 days
      },
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      defaultDatabaseName: props.dbName,
      storageEncrypted: true,
      storageEncryptionKey: props.appKey,
      //      cloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit'],  // For Aurora MySQL
      cloudwatchLogsExports: ['postgresql'], // For Aurora PostgreSQL
      cloudwatchLogsRetention: logs.RetentionDays.THREE_MONTHS,
      instanceIdentifierBase: 'instance',
    });
    cluster.connections.allowDefaultPortFrom(props.appServerSecurityGroup);

    // ----------------------- Alarms for RDS -----------------------------

    // Aurora Cluster CPU Utilization
    cluster
      .metricCPUUtilization({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'AuroraCPUUtil', {
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
    //     dimensions: {
    //       DBInstanceIdentifier: instance
    //     },
    //     period: cdk.Duration.minutes(1),
    //     statistic: cw.Statistic.AVERAGE,
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
    new rds.CfnEventSubscription(this, 'RdsEventsCluster', {
      snsTopicArn: props.alarmTopic.topicArn,
      enabled: true,
      sourceType: 'db-cluster',
      eventCategories: ['failure', 'failover', 'maintenance'],
    });

    new rds.CfnEventSubscription(this, 'RdsEventsInstances', {
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
