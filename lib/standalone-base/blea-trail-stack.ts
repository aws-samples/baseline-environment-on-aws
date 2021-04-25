import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as trail from '@aws-cdk/aws-cloudtrail';
import * as cwl from '@aws-cdk/aws-logs';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';

export class BLEATrailStack extends cdk.Stack {
  public readonly cloudTrailLogGroup: cwl.LogGroup;

  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Archive Bucket for CloudTrail
    const archiveLogsBucket = new s3.Bucket(this, 'ArchiveLogsBucket', {
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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
    this.addBaseBucketPolicy(archiveLogsBucket);

    // Bucket for CloudTrail
    const cloudTrailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      serverAccessLogsBucket: archiveLogsBucket,
      serverAccessLogsPrefix: 'cloudtraillogs',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.addBaseBucketPolicy(cloudTrailBucket);

    // CMK for CloudTrail
    const cloudTrailKey = new kms.Key(this, 'CloudTrailKey', {
      enableKeyRotation: true,
      description: 'for CloudTrail',
      alias: 'for-cloudtrail',
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
        principals: [new iam.Anyone()],
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
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${props?.env?.region}:${
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
    this.cloudTrailLogGroup = cloudTrailLogGroup;

    // CloudTrail
    new trail.Trail(this, 'CloudTrail', {
      bucket: cloudTrailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      cloudWatchLogGroup: cloudTrailLogGroup,
      encryptionKey: cloudTrailKey,
      sendToCloudWatchLogs: true,
    });

    // -----------

    // EC2 Role for Manage CloudTrail Logs
    const cloudTrailRole = new iam.Role(this, 'CloudTrailRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    cloudTrailBucket.grantPut(cloudTrailRole);
    cloudTrailBucket.grantRead(cloudTrailRole);
  }

  // Add base BucketPolicy for CloudTrail
  addBaseBucketPolicy(bucket: s3.Bucket): void {
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Enforce HTTPS Connections',
        effect: iam.Effect.DENY,
        actions: ['s3:*'],
        principals: [new iam.AnyPrincipal()],
        resources: [bucket.arnForObjects('*')],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
      }),
    );

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
}
