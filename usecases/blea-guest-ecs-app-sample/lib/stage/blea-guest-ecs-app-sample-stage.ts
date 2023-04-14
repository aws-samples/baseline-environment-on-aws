import { Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppParameter } from '../../parameter';
import { BLEAEcsFrontendStack } from '../stack/blea-guest-ecs-app-frontend-stack';
import { BLEAEcsAppMonitoringStack } from '../stack/blea-guest-ecs-app-monitoring-stack';
import { BLEAEcsAppStack } from '../stack/blea-guest-ecs-app-sample-stack';

export class BLEAEcsAppStage extends Stage {
  constructor(scope: Construct, id: string, props: AppParameter) {
    super(scope, id, props);

    const ecsapp = new BLEAEcsAppStack(this, 'BLEAEcsApp', {
      // from parameter.ts
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
      vpcCidr: props.vpcCidr,
      hostedZoneId: props.hostedZoneId,
      domainName: props.domainName,
      albHostName: props.albHostName,

      // props of cdk.Stack
      tags: {
        Repository: 'aws-samples/baseline-environment-on-aws',
        Environment: props.envName,
      },
      env: {
        account: props.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: props.env?.region || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
      },
      crossRegionReferences: true,
    });

    const frontend = new BLEAEcsFrontendStack(this, 'BLEAEcsFrontend', {
      // from parameter.ts
      hostedZoneId: props.hostedZoneId,
      domainName: props.domainName,
      albHostName: props.albHostName,
      cloudFrontHostName: props.cloudFrontHostName,

      // from EcsApp stack
      alarmTopic: ecsapp.alarmTopic,

      // props of cdk.Stack
      env: {
        account: props.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: 'us-east-1',
      },
      crossRegionReferences: true,
    });

    new BLEAEcsAppMonitoringStack(this, 'BLEAEcsMonitoring', {
      // from parameter.ts
      appEndpoint: `${props.cloudFrontHostName}.${props.domainName}`,
      dashboardName: props.dashboardName,

      // from EcsApp stack
      alarmTopic: ecsapp.alarmTopic,
      albFullName: ecsapp.albFullName,
      albTargetGroupName: ecsapp.albTargetGroupName,
      albTargetGroupUnhealthyHostCountAlarm: ecsapp.albTargetGroupUnhealthyHostCountAlarm,
      ecsClusterName: ecsapp.ecsClusterName,
      ecsServiceName: ecsapp.ecsServiceName,
      ecsScaleOnRequestCount: ecsapp.ecsScaleOnRequestCount,
      ecsTargetUtilizationPercent: ecsapp.ecsTargetUtilizationPercent,
      dbClusterName: ecsapp.dbClusterName,

      // from Frontend stack
      distributionId: frontend.distributionId,

      // props of cdk.Stack
      env: {
        account: props.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: props.env?.region || process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
      },
      crossRegionReferences: true,
    });
  }
}
