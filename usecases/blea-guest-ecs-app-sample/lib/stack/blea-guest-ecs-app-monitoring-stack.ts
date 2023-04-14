import { Stack, StackProps } from 'aws-cdk-lib';
import { IAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { ITopic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { Dashboard } from '../construct/dashboard';
import { Canary } from '../construct/canary';

export interface BLEAEcsAppMonitoringStackProps extends StackProps {
  alarmTopic: ITopic;
  appEndpoint: string;
  distributionId: string;
  dashboardName: string;
  albFullName: string;
  albTargetGroupName: string;
  albTargetGroupUnhealthyHostCountAlarm: IAlarm;
  ecsClusterName: string;
  ecsServiceName: string;
  ecsTargetUtilizationPercent: number;
  ecsScaleOnRequestCount: number;
  dbClusterName: string;
}
export class BLEAEcsAppMonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAEcsAppMonitoringStackProps) {
    super(scope, id, props);

    const canary = new Canary(this, 'Canary', {
      alarmTopic: props.alarmTopic,
      appEndpoint: props.appEndpoint,
    });

    new Dashboard(this, 'Dashboard', {
      distributionId: props.distributionId,
      dashboardName: props.dashboardName,
      albFullName: props.albFullName,
      ecsClusterName: props.ecsClusterName,
      ecsServiceName: props.ecsServiceName,
      albTargetGroupName: props.albTargetGroupName,
      dbClusterName: props.dbClusterName,
      albTargetGroupUnhealthyHostCountAlarm: props.albTargetGroupUnhealthyHostCountAlarm,
      ecsTargetUtilizationPercent: props.ecsTargetUtilizationPercent,
      ecsScaleOnRequestCount: props.ecsScaleOnRequestCount,
      canaryDurationAlarm: canary.canaryDurationAlarm,
      canaryFailedAlarm: canary.canaryFailedAlarm,
    });
  }
}
