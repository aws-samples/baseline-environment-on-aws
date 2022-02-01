import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_kms as kms } from 'aws-cdk-lib';

export class BLEAKeyApiappStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
