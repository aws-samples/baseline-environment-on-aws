import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

export interface BLEAVpcStackProps extends cdk.StackProps {
  myVpcCidr: string;
}

export class BLEAVpcStack extends cdk.Stack {
  public readonly myVpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: BLEAVpcStackProps) {
    super(scope, id, props);

    const myVpc = new ec2.Vpc(this, 'Vpc', {
      cidr: props.myVpcCidr,
      maxAzs: 2,
      natGateways: 0,
      flowLogs: {},
      subnetConfiguration: [
        {
          cidrMask: 22,
          name: 'ProtectedLambda',
          subnetType: ec2.SubnetType.ISOLATED,
        },
        {
          cidrMask: 22,
          name: 'ProtectedAurora',
          subnetType: ec2.SubnetType.ISOLATED,
        },
      ],
    });

    //  --------------------------------------------------------------
    //  Bucket for VPC Flow log

    // CMK
    const flowLogKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for VPC Flow log',
      alias: `${id}-for-flowlog`,
    });
    flowLogKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        resources: ['*'],
      }),
    );

    // Bucket
    const flowLogBucket = new s3.Bucket(this, 'FlowLogBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryptionKey: flowLogKey,
      encryption: s3.BucketEncryption.KMS,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    myVpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(flowLogBucket),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // VPC Endpoint for S3
    myVpc.addGatewayEndpoint('S3EndpointForPrivate', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.ISOLATED }],
    });

    this.myVpc = myVpc;
  }
}
