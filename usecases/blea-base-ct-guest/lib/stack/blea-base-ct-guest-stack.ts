import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityIAM } from '../construct/security-iam';
import { SecurityLogging } from '../construct/security-logging';
import { SecurityDetection } from '../construct/security-detection';

export interface BLEAGovBaseStackProps extends StackProps {
  securityNotifyEmail: string;
}

export class BLEAGovBaseStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAGovBaseStackProps) {
    super(scope, id, props);

    new SecurityIAM(this, 'SecurityIAM');

    // AWS CloudTrail configuration in Control Tower Landing Zone v3.0 will not create CloudWatch Logs LogGroup in each Guest Accounts.
    // And it will delete these LogGroups when AWS CloudTrial Configuration is disabled in case of updating Landing Zone version from older one.
    // BLEA should notify their alarms continuously. So, if there is no CloudTrail and CloudWatch Logs in Guest Account, BLEA creates them to notify the Alarms.
    const securityLogging = new SecurityLogging(this, 'SecurityLogging');

    // Security Alarms
    // !!! Need to setup SecurityHub, GuardDuty manually on Organizations Management account
    // AWS Config and CloudTrail are set up by ControlTower
    new SecurityDetection(this, 'SecurityDetection', {
      notifyEmail: props.securityNotifyEmail,
      cloudTrailLogGroupName: securityLogging.trailLogGroup.logGroupName,
    });
  }
}
