import { Names, Stack, StackProps } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Api } from '../construct/api';
import { Datastore } from '../construct/datastore';
import { Monitoring } from '../construct/monitoring';

export interface BLEAServerlessApiStackProps extends StackProps {
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
}
export class BLEAServerlessApiStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAServerlessApiStackProps) {
    super(scope, id, props);

    const monitoring = new Monitoring(this, 'Monitoring', {
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
    });

    const cmk = new Key(this, 'CMK', {
      enableKeyRotation: true,
      description: 'BLEA Guest Sample: CMK for ServerlessApi',
      alias: Names.uniqueResourceName(this, {}),
    });

    const datastore = new Datastore(this, 'Datastore', {
      alarmTopic: monitoring.alarmTopic,
      appKey: cmk,
    });

    new Api(this, 'Api', {
      alarmTopic: monitoring.alarmTopic,
      appKey: cmk,
      table: datastore.table,
    });
  }
}
