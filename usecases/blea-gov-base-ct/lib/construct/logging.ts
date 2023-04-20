import * as cdk from 'aws-cdk-lib';
import {
  aws_cloudtrail as trail,
  aws_config as config,
  aws_iam as iam,
  aws_kms as kms,
  aws_logs as cwl,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class Logging extends Construct {
  public readonly trailLogGroup: cwl.LogGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // === AWS CloudTrail ===
    // Server Access Log Bucket for CloudTrail
    const cloudTrailAccessLogBucket = new s3.Bucket(this, 'CloudTrailAccessLogBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(2555),
          transitions: [
            {
              transitionAfter: cdk.Duration.days(90),
              storageClass: s3.StorageClass.GLACIER,
            },
          ],
        },
      ],
    });
    addBaseBucketPolicy(cloudTrailAccessLogBucket);

    // Bucket for CloudTrail
    const cloudTrailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      serverAccessLogsBucket: cloudTrailAccessLogBucket,
      serverAccessLogsPrefix: 'cloudtraillogs',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });
    cloudTrailBucket.node.addDependency();
    addBaseBucketPolicy(cloudTrailBucket);

    // CMK for CloudTrail
    const cloudTrailKey = new kms.Key(this, 'CloudTrailKey', {
      enableKeyRotation: true,
      description: 'BLEA Governance Base: CMK for CloudTrail',
      alias: cdk.Names.uniqueResourceName(this, {}),
    });
    cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:GenerateDataKey*'],
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        resources: ['*'],
        conditions: {
          StringLike: {
            'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(this).account}:trail/*`],
          },
        },
      }),
    );
    cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:DescribeKey'],
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        resources: ['*'],
      }),
    );
    cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Decrypt', 'kms:ReEncryptFrom'],
        principals: [new iam.AnyPrincipal()],
        resources: ['*'],
        conditions: {
          StringEquals: { 'kms:CallerAccount': `${cdk.Stack.of(this).account}` },
          StringLike: {
            'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(this).account}:trail/*`],
          },
        },
      }),
    );
    cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal('logs.amazonaws.com')],
        resources: ['*'],
        conditions: {
          ArnEquals: {
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${cdk.Stack.of(this).region}:${
              cdk.Stack.of(this).account
            }:log-group:*`,
          },
        },
      }),
    );

    // CloudWatch Logs Group for CloudTrail
    const cloudTrailLogGroup = new cwl.LogGroup(this, 'CloudTrailLogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
      encryptionKey: cloudTrailKey,
    });
    this.trailLogGroup = cloudTrailLogGroup;

    // CloudTrail
    new trail.Trail(this, 'CloudTrail', {
      bucket: cloudTrailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      cloudWatchLogGroup: cloudTrailLogGroup,
      encryptionKey: cloudTrailKey,
      sendToCloudWatchLogs: true,
    });
  }
}

// Add base BucketPolicy for CloudTrail
function addBaseBucketPolicy(bucket: s3.Bucket): void {
  bucket.addToResourcePolicy(
    new iam.PolicyStatement({
      sid: 'Restrict Delete* Actions',
      effect: iam.Effect.DENY,
      actions: ['s3:Delete*'],
      principals: [new iam.AnyPrincipal()],
      resources: [bucket.arnForObjects('*')],
    }),
  );
}
