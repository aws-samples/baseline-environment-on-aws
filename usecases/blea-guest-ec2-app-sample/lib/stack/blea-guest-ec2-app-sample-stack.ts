import { Names, Stack, StackProps } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Ec2App } from '../construct/ec2app';
import { Monitoring } from '../construct/monitoring';
import { Networking } from '../construct/networking';
import { InvestigationInstance } from '../construct/investigation-instance';

export interface BLEAEc2AppStackProps extends StackProps {
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;
}

export class BLEAEc2AppStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAEc2AppStackProps) {
    super(scope, id, props);

    new Monitoring(this, 'Monitoring', {
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
    });

    const cmk = new Key(this, 'CMK', {
      enableKeyRotation: true,
      description: 'BLEA Guest Sample: CMK for Ec2App',
      alias: Names.uniqueResourceName(this, {}),
    });

    const networking = new Networking(this, 'Networking', {
      vpcCidr: props.vpcCidr,
    });

    new Ec2App(this, 'Ec2App', {
      cmk: cmk,
      vpc: networking.vpc,
    });

    new InvestigationInstance(this, 'InvestigationInstance', {
      vpc: networking.vpc,
    });
  }
}
