import { Stack, StackProps } from 'aws-cdk-lib';
import { ITopic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { Frontend } from '../construct/frontend';
import { ILoadBalancerV2 } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export interface BLEAEcsAppFrontendStackProps extends StackProps {
  alarmTopic: ITopic;
  alb: ILoadBalancerV2;
  // -- Sample to use custom domain on CloudFront
  // hostedZoneId: string;
  // domainName: string;
  // cloudFrontHostName: string;
}

export class BLEAEcsAppFrontendStack extends Stack {
  public readonly distributionId: string;
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: BLEAEcsAppFrontendStackProps) {
    super(scope, id, props);

    const frontend = new Frontend(this, 'Frontend', {
      alb: props.alb,
      // -- Sample to use custom domain on CloudFront
      // hostedZoneId: props.hostedZoneId,
      // domainName: props.domainName,
      // cloudFrontHostName: props.cloudFrontHostName,
    });
    this.exportValue(frontend.distributionDomainName);
    this.distributionId = frontend.distributionId;
    this.distributionDomainName = frontend.distributionDomainName;
  }
}
