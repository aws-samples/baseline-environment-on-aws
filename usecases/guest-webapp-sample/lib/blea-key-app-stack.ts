import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_kms as kms } from 'aws-cdk-lib';

export class BLEAKeyAppStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CMK
    const kmsKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for App',
      alias: `${id}-for-app`,
    });
    this.kmsKey = kmsKey;
  }
}
