import * as cdk from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';

export class GcFlowLogKeyStack extends cdk.Stack {
  public readonly flowlogKey: kms.Key;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CMK
    const flowlogKey = new kms.Key(this, 'FlowLogKey', {
      enableKeyRotation: true,
      description: "for VPC Flow log",
      alias: "for-flowlog"
    })
    this.flowlogKey = flowlogKey;

  }
}
