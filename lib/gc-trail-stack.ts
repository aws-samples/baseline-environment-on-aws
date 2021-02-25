import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as trail from '@aws-cdk/aws-cloudtrail';
import * as cwl from '@aws-cdk/aws-logs';
import * as iam from '@aws-cdk/aws-iam';

export class GcTrailStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // CloudWatch Logs Group for CloudTrail
    const cloudTrailLogGroup = new cwl.LogGroup(this, 'CloudTrailLogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
    });

    // Archive Bucket for CloudTrail
    const archiveLogsBucket = new s3.Bucket(this, 'ArchiveLogsBucket', {
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [ 
        {
          enabled: true,
          expiration: cdk.Duration.days(2555),
          transitions: [
            {
              transitionAfter: cdk.Duration.days(90),
              storageClass: s3.StorageClass.GLACIER
            }
          ]
        }
      ]
    });
    this.addBaseBucketPolicy(archiveLogsBucket);

    // Bucket for CloudTrail
    const cloudTrailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      versioned: true,
      serverAccessLogsBucket: archiveLogsBucket,
      serverAccessLogsPrefix: "cloudtraillogs",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.addBaseBucketPolicy(cloudTrailBucket);

    // CloudTrail
    const cloudTrailLoggingLocal = new trail.Trail(this, 'CloudTrail', {
      bucket: cloudTrailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      cloudWatchLogGroup: cloudTrailLogGroup,
      sendToCloudWatchLogs: true
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
  addBaseBucketPolicy(bucket: s3.Bucket) :void {
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'Enforce HTTPS Connections',
      effect: iam.Effect.DENY,
      actions: ['s3:*'],
      principals: [ new iam.AnyPrincipal() ],
      resources: [ bucket.arnForObjects('*') ],
      conditions: {
        'Bool': {
          'aws:SecureTransport': false
        }
      }
    }));

    bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'Restrict Delete* Actions',
      effect: iam.Effect.DENY,
      actions: ['s3:Delete*'],
      principals: [ new iam.AnyPrincipal() ],
      resources: [ bucket.arnForObjects('*') ]      
    }));

    bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'DenyUnEncryptedObjectUploads',
      effect: iam.Effect.DENY,
      actions: ['s3:PutObject'],
      principals: [ new iam.AnyPrincipal() ],
      resources: [ bucket.arnForObjects('*') ],
      conditions:  {
        'StringNotEquals': {
          's3:x-amz-server-side-encryption': 'AES256'
        }
      }
    }));
   
  }

}
