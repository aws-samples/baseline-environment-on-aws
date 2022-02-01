import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_rds as rds } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';

export interface BLEADbAuroraPgSlStackProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  dbName: string;
  dbUser: string;
  dbAllocatedStorage: number;
  appKey: kms.IKey;
  vpcSubnets: ec2.SubnetSelection;
  appServerSecurityGroup: ec2.SecurityGroup;
  alarmTopic: sns.Topic;
}

export class BLEADbAuroraPgSlStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BLEADbAuroraPgSlStackProps) {
    super(scope, id, props);

    const serverlessCluster = new rds.ServerlessCluster(this, 'AuroraServerless', {
      engine: rds.DatabaseClusterEngine.AURORA_POSTGRESQL,
      parameterGroup: rds.ParameterGroup.fromParameterGroupName(this, 'ParameterGroup', 'default.aurora-postgresql10'),
      vpc: props.myVpc,
      vpcSubnets: props.vpcSubnets,
      scaling: {
        autoPause: cdk.Duration.minutes(10), // default is to pause after 5 minutes of idle time
        minCapacity: rds.AuroraCapacityUnit.ACU_8, // default is 2 Aurora capacity units (ACUs)
        maxCapacity: rds.AuroraCapacityUnit.ACU_32, // default is 16 Aurora capacity units (ACUs)
      },
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      defaultDatabaseName: props.dbName,
      storageEncryptionKey: props.appKey,
    });

    serverlessCluster;

    // ----------------------- Alarms for RDS -----------------------------
    new cw.Metric({
      metricName: 'CPUUtilization',
      namespace: 'AWS/RDS',
      dimensionsMap: {
        DBClusterIdentifier: serverlessCluster.clusterIdentifier,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Statistic.AVERAGE,
    })
      .createAlarm(this, 'CPUUtilization', {
        evaluationPeriods: 3,
        datapointsToAlarm: 2,
        threshold: 90,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
  }
}
