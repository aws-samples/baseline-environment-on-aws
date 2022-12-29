import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityDetection } from './construct/blea-security-detection';
import { SecurityIAM } from './construct/blea-security-iam';
import { SecurityLogging } from './construct/blea-security-logging';

export interface BLEABaseSAProps extends StackProps {
  securityNotifyEmail: string;
}

export class BLEABaseSAStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEABaseSAProps) {
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
