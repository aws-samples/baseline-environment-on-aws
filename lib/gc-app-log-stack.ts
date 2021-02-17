import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as logs from '@aws-cdk/aws-logs';
import * as kms from '@aws-cdk/aws-kms';
import * as iam from '@aws-cdk/aws-iam';


interface GcAppLogStackProps extends cdk.StackProps {
  appKey: kms.IKey
}

export class GcAppLogStack extends cdk.Stack {
  public readonly logBucket: s3.Bucket;
  public readonly logGroup: logs.LogGroup;

  
  constructor(scope: cdk.Construct, id: string, props: GcAppLogStackProps) {
    super(scope, id, props);

    //S3 bucket for Application Logging
    const appLogBucket = new s3.Bucket(this, 'AppLogBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryptionKey: props.appKey,
      encryption: s3.BucketEncryption.KMS,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    this.logBucket = appLogBucket;

    //CW LogGroup for Application Logging
    const appLogGroup = new logs.LogGroup(this, 'AppLogGroup', {
      retention: logs.RetentionDays.INFINITE,
      encryptionKey: props.appKey
    }); 
    this.logGroup = appLogGroup;


    props.appKey.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
        "kms:Encrypt*",
        "kms:Decrypt*",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:Describe*"        
      ],
      principals: [
        new iam.ServicePrincipal('logs.amazonaws.com'),
        new iam.ServicePrincipal('s3.amazonaws.com')
      ],
      resources: ['*'],
      // conditions: {
      //   ArnEquals: appLogGroup.logGroupArn
      //   ArnEquals: appLogBucket.bucketArn
    }));

  }
  
}