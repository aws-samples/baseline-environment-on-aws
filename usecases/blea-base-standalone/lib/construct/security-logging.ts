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

export class SecurityLogging extends Construct {
  public readonly trailLogGroup: cwl.LogGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // === AWS CloudTrail ===
    // Archive Bucket for CloudTrail
    const archiveLogsBucket = new s3.Bucket(this, 'ArchiveLogsBucket', {
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
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
    addBaseBucketPolicy(archiveLogsBucket);

    // Bucket for CloudTrail
    const cloudTrailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      serverAccessLogsBucket: archiveLogsBucket,
      serverAccessLogsPrefix: 'cloudtraillogs',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });
    cloudTrailBucket.node.addDependency();
    addBaseBucketPolicy(cloudTrailBucket);

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

    // === AWS Config ===
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
      enforceSSL: true,
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