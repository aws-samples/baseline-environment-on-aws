import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as kms from '@aws-cdk/aws-kms';
import * as iam from '@aws-cdk/aws-iam';

interface BLEAGeneralLogStackProps extends cdk.StackProps {
  kmsKey: kms.IKey;
}

export class BLEAGeneralLogStack extends cdk.Stack {
  public readonly logBucket: s3.Bucket;

  constructor(scope: cdk.Construct, id: string, props: BLEAGeneralLogStackProps) {
    super(scope, id, props);

    //S3 bucket for Application Logging
    const LogBucket = new s3.Bucket(this, 'GeneralLogBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryptionKey: props.kmsKey,
      encryption: s3.BucketEncryption.KMS,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.logBucket = LogBucket;

    props.kmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        resources: ['*'],
      }),
    );
  }
}
