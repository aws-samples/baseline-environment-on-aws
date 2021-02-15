import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import { SecretValue } from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';

export interface BsDbStackProps extends cdk.StackProps {
  prodVpc: ec2.Vpc,
  dbName: string,
  dbUser: string,
  environment: string,
  dbAllocatedStorage: number,
  appKey: kms.IKey,
  vpcSubnets: ec2.SubnetSelection,
  appServerSecurityGroup: ec2.SecurityGroup
}

export class BsDbStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: BsDbStackProps) {
    super(scope, id, props);

    // Create RDS MySQL Instance
    const cluster = new rds.DatabaseCluster(this, 'AuroraMySQL', {
      // for Aurora PostgreSQL
      engine: rds.DatabaseClusterEngine.auroraPostgres({ 
        version: rds.AuroraPostgresEngineVersion.VER_11_9
      }),
      // for Aurora MySQL
      // engine: rds.DatabaseClusterEngine.auroraMysql({ 
      //   version: rds.AuroraMysqlEngineVersion.VER_2_09_1
      // }),
      credentials: rds.Credentials.fromGeneratedSecret(props.dbUser),
      instanceProps: {
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MEDIUM
        ),
        vpcSubnets: props.vpcSubnets,
        vpc: props.prodVpc
      },
      defaultDatabaseName: props.dbName,
      storageEncrypted: true,
      storageEncryptionKey: props.appKey,
//      cloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit'],  // For Aurora MySQL
      cloudwatchLogsExports: ['postgresql'],  // For Aurora PostgreSQL
      cloudwatchLogsRetention: logs.RetentionDays.THREE_MONTHS,
    });
    cluster.connections.allowDefaultPortFrom(props.appServerSecurityGroup)
  }
}
