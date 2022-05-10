import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_config as config } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';

export class BLEAConfigStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, 'ConfigRole', {
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWS_ConfigRole')],
    });

    new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      roleArn: role.roleArn,
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
      },
    });

    const bucket = new s3.Bucket(this, 'ConfigBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Attaches the AWSConfigBucketPermissionsCheck policy statement.
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [role],
        resources: [bucket.bucketArn],
        actions: ['s3:GetBucketAcl'],
      }),
    );

    // Attaches the AWSConfigBucketDelivery policy statement.
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [role],
        resources: [bucket.arnForObjects(`AWSLogs/${cdk.Stack.of(this).account}/Config/*`)],
        actions: ['s3:PutObject'],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
      }),
    );

    new config.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      s3BucketName: bucket.bucketName,
    });
  }
}
