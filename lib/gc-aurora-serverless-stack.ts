import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';
import * as sns from '@aws-cdk/aws-sns';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cw_actions from '@aws-cdk/aws-cloudwatch-actions';

export interface GcAuroraServerlessStackProps extends cdk.StackProps {
  prodVpc: ec2.Vpc,
  dbName: string,
  dbUser: string,
  environment: string,
  dbAllocatedStorage: number,
  appKey: kms.IKey,
  vpcSubnets: ec2.SubnetSelection,
  appServerSecurityGroup: ec2.SecurityGroup,
  alarmTopic: sns.Topic, 
}

export class GcAuroraServerlessStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: GcAuroraServerlessStackProps) {
    super(scope, id, props);

    const serverlessCluster = new rds.ServerlessCluster(this, 'AuroraServerless', {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql10'),
      vpc: props.prodVpc,
      vpcSubnets: props.vpcSubnets,
      scaling: {
        autoPause: cdk.Duration.minutes(10), // default is to pause after 5 minutes of idle time
        minCapacity: rds.AuroraCapacityUnit.ACU_8, // default is 2 Aurora capacity units (ACUs)
        maxCapacity: rds.AuroraCapacityUnit.ACU_32, // default is 16 Aurora capacity units (ACUs)
      },
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      defaultDatabaseName: props.dbName,
      storageEncryptionKey: props.appKey
    });

    // ----------------------- Alarms for RDS -----------------------------
    new cw.Metric({
      metricName: 'CPUUtilization',
      namespace: 'AWS/RDS',
      dimensions: {
        DBClusterIdentifier: serverlessCluster.clusterIdentifier,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Statistic.AVERAGE,
    }).createAlarm(this, 'CPUUtilization', {
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      threshold: 90,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      actionsEnabled: true
    }).addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

  }
}
