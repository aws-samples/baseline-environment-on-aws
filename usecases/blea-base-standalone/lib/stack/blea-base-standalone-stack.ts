import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityDetection } from '../construct/security-detection';
import { SecurityIAM } from '../construct/security-iam';
import { SecurityLogging } from '../construct/security-logging';

export interface BLEAGovBaseProps extends StackProps {
  securityNotifyEmail: string;
}

export class BLEAGovBaseStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAGovBaseProps) {
    super(scope, id, props);

    new SecurityIAM(this, 'SecurityIAM');
    const securityLogging = new SecurityLogging(this, 'SecurityLogging');
    const securityDetection = new SecurityDetection(this, 'SecurityDetection', {
      cloudTrailLogGroupName: securityLogging.trailLogGroup.logGroupName,
      notifyEmail: props.securityNotifyEmail,
    });

    // You must create a configuration recorder before you can create or update a Config rule.
    securityDetection.node.addDependency(securityLogging);
  }
}
