import { Stack, Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Detection } from '../construct/security-detection';
import { Iam } from '../construct/security-iam';
import { Logging } from '../construct/security-logging';
import { BLEAGovBaseCtStackProps } from '../stack/blea-base-ct-guest-stack';

export class BLEAGovBaseCtStage extends Stage {
  constructor(scope: Construct, id: string, props: BLEAGovBaseCtStackProps) {
    super(scope, id, props);

    // Define a stack and associate same constructs as normal to this.
    const stack = new Stack(this, 'BLEAGovBase');

    new Iam(stack, 'Iam');

    // AWS CloudTrail configuration in Control Tower Landing Zone v3.0 will not create CloudWatch Logs LogGroup in each Guest Accounts.
    // And it will delete these LogGroups when AWS CloudTrial Configuration is disabled in case of updating Landing Zone version from older one.
    // BLEA should notify their alarms continuously. So, if there is no CloudTrail and CloudWatch Logs in Guest Account, BLEA creates them to notify the Alarms.
    const logging = new Logging(stack, 'Logging');

    // Security Alarms
    // !!! Need to setup SecurityHub, GuardDuty manually on Organizations Management account
    // AWS Config and CloudTrail are set up by ControlTower
    new Detection(stack, 'Detection', {
      notifyEmail: props.securityNotifyEmail,
      cloudTrailLogGroupName: logging.trailLogGroup.logGroupName,
    });
  }
}
