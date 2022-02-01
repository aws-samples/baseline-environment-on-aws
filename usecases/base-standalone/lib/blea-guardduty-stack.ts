import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_guardduty as guardduty } from 'aws-cdk-lib';

export class BLEAGuarddutyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true,
    });
  }
}
