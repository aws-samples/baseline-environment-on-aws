import * as cdk from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';

export class bsAppKeyStack extends cdk.Stack {
  public readonly appKey: kms.Key;
  
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CMK
    const appKey = new kms.Key(this, 'app-key', {
      enableKeyRotation: true
    })
    this.appKey = appKey;

  }
  
}