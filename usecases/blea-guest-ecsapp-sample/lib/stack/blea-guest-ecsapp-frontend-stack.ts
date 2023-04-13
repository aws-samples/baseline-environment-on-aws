import { Stack, StackProps } from 'aws-cdk-lib';
import { ITopic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { Frontend } from '../construct/frontend';

export interface BLEAEcsFrontendStackProps extends StackProps {
  alarmTopic: ITopic;
  hostedZoneId: string;
  domainName: string;
  albHostName: string;
  cloudFrontHostName: string;
}

export class BLEAEcsFrontendStack extends Stack {
  public readonly distributionId: string;
  constructor(scope: Construct, id: string, props: BLEAEcsFrontendStackProps) {
    super(scope, id, props);

    const frontend = new Frontend(this, 'Frontend', {
      hostedZoneId: props.hostedZoneId,
      domainName: props.domainName,
      albHostName: props.albHostName,
      cloudFrontHostName: props.cloudFrontHostName,
    });
    this.distributionId = frontend.distributionId;
  }
}
