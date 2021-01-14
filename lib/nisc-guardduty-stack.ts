import * as cdk from '@aws-cdk/core';
import * as cfn_inc from '@aws-cdk/cloudformation-include';
import * as guardduty from '@aws-cdk/aws-guardduty';

export class NiscGuarddutyStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true
    });

  }
}
