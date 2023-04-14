import { Names, Stack, StackProps } from 'aws-cdk-lib';
import { IAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { Key } from 'aws-cdk-lib/aws-kms';
import { ITopic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { Datastore } from '../construct/datastore';
import { EcsApp } from '../construct/ecsapp';
import { Monitoring } from '../construct/monitoring';
import { Networking } from '../construct/networking';

export interface BLEAEcsAppStackProps extends StackProps {
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;
  hostedZoneId: string;
  domainName: string;
  albHostName: string;
}

export class BLEAEcsAppStack extends Stack {
  public readonly alarmTopic: ITopic;
  public readonly albFullName: string;
  public readonly albTargetGroupName: string;
  public readonly albTargetGroupUnhealthyHostCountAlarm: IAlarm;
  public readonly ecsClusterName: string;
  public readonly ecsServiceName: string;
  public readonly ecsTargetUtilizationPercent: number;
  public readonly ecsScaleOnRequestCount: number;
  public readonly dbClusterName: string;

  constructor(scope: Construct, id: string, props: BLEAEcsAppStackProps) {
    super(scope, id, props);

    const monitoring = new Monitoring(this, 'Monitoring', {
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
    });
    this.alarmTopic = monitoring.alarmTopic;

    const cmk = new Key(this, 'CMK', {
      enableKeyRotation: true,
      description: 'BLEA Guest Sample: CMK for EcsApp',
      alias: Names.uniqueResourceName(this, {}),
    });

    const networking = new Networking(this, 'Networking', {
      vpcCidr: props.vpcCidr,
    });

    const datastore = new Datastore(this, 'Datastore', {
      vpc: networking.vpc,
      cmk: cmk,
      alarmTopic: monitoring.alarmTopic,
    });
    this.dbClusterName = datastore.dbCluster.clusterIdentifier;

    const ecsapp = new EcsApp(this, 'EcsApp', {
      alarmTopic: monitoring.alarmTopic,
      cmk: cmk,
      vpc: networking.vpc,
      hostedZoneId: props.hostedZoneId,
      domainName: props.domainName,
      albHostName: props.albHostName,
      dbCluster: datastore.dbCluster,
    });
    this.exportValue(ecsapp.alb.loadBalancerDnsName);
    this.albFullName = ecsapp.albFullName;
    this.albTargetGroupName = ecsapp.albTargetGroupName;
    this.albTargetGroupUnhealthyHostCountAlarm = ecsapp.albTargetGroupUnhealthyHostCountAlarm;
    this.ecsClusterName = ecsapp.ecsClusterName;
    this.ecsServiceName = ecsapp.ecsServiceName;
    this.ecsTargetUtilizationPercent = ecsapp.ecsTargetUtilizationPercent;
    this.ecsScaleOnRequestCount = ecsapp.ecsScaleOnRequestCount;
  }
}
