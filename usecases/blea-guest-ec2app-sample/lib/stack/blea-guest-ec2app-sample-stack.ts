import { Stack, StackProps } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Ec2App } from '../construct/ec2app';
import { Monitoring } from '../construct/monitoring';
import { Networking } from '../construct/networking';
import { InvestigationInstance } from '../construct/investigation-instance';

export interface BLEAEc2AppSampleStackProps extends StackProps {
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;
}

export class BLEAEc2AppSampleStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAEc2AppSampleStackProps) {
    super(scope, id, props);

    new Monitoring(this, 'Monitoring', {
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
    });

    const cmk = new Key(this, 'CMK', {
      enableKeyRotation: true,
      description: 'guest-ec2app-key',
      alias: 'guest-ec2app-key',
    });

    const networking = new Networking(this, 'Networking', {
      vpcCidr: props.vpcCidr,
    });

    new Ec2App(this, 'Ec2App', {
      cmk: cmk,
      vpc: networking.myVpc,
    });

    new InvestigationInstance(this, 'InvestigationInstance', {
      vpc: networking.myVpc,
    });
  }
}
