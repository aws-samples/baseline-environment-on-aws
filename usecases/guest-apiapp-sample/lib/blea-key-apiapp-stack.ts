import * as cdk from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';

export class BLEAKeyApiappStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // KMS CMK
    const kmsKey = new kms.Key(this, 'KeyApiapp', {
      enableKeyRotation: true,
      description: 'for Apiapp',
      alias: `${id}-for-apiapp`,
    });
    this.kmsKey = kmsKey;
  }
}
