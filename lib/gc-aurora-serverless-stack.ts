import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as kms from '@aws-cdk/aws-kms';
import * as logs from '@aws-cdk/aws-logs';

export interface GcAuroraServerlessStackProps extends cdk.StackProps {
  prodVpc: ec2.Vpc,
  dbName: string,
  dbUser: string,
  environment: string,
  dbAllocatedStorage: number,
  appKey: kms.IKey,
  vpcSubnets: ec2.SubnetSelection,
  appServerSecurityGroup: ec2.SecurityGroup
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
      }
    });
  }
}
