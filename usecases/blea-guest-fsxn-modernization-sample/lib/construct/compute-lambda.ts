import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_iam as iam, aws_lambda as lambda, aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ComputeLambdaProps {
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  s3AccessPointArn: string;
  s3AccessPointAlias: string;
}

/**
 * Lambda function accessing FSxN data via S3 Access Point (VPC-origin).
 * Pattern: Serverless file processing without NFS client.
 *
 * ECS Fargate note: Fargate does NOT support direct NFS mount to FSxN.
 * Use this S3 AP pattern for Fargate workloads. For POSIX access, use EC2 pattern.
 */
export class ComputeLambda extends Construct {
  constructor(scope: Construct, id: string, props: ComputeLambdaProps) {
    super(scope, id);

    const fn = new lambda.Function(this, 'FileProcessor', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

exports.handler = async (event) => {
  const s3 = new S3Client({});
  const bucket = process.env.S3_AP_ALIAS;

  // List files via S3 Access Point
  const listResult = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    MaxKeys: 10,
  }));

  console.log(JSON.stringify({
    event: 'file_listing',
    fileCount: listResult.KeyCount,
    files: (listResult.Contents || []).map(c => ({ key: c.Key, size: c.Size })),
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ fileCount: listResult.KeyCount }),
  };
};
`),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logGroup: new logs.LogGroup(this, 'LogGroup', { retention: logs.RetentionDays.ONE_MONTH }),
      environment: {
        S3_AP_ALIAS: props.s3AccessPointAlias,
      },
    });

    // IAM: Scoped to S3 Access Point ARN only
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [props.s3AccessPointArn, `${props.s3AccessPointArn}/object/*`],
      }),
    );
  }
}
