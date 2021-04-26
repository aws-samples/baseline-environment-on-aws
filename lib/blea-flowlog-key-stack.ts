import * as cdk from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';

export class BLEAFlowLogKeyStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CMK
    const kmsKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for VPC Flow log',
      alias: `${id}-for-flowlog`,
    });
    this.kmsKey = kmsKey;
  }
}
