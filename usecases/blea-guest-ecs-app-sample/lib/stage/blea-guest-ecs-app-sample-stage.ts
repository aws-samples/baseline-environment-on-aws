import { Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppParameter } from '../../parameter';
import { BLEAEcsAppFrontendStack } from '../stack/blea-guest-ecs-app-frontend-stack';
import { BLEAEcsAppMonitoringStack } from '../stack/blea-guest-ecs-app-monitoring-stack';
import { BLEAEcsAppStack } from '../stack/blea-guest-ecs-app-sample-stack';

export class BLEAEcsAppStage extends Stage {
  constructor(scope: Construct, id: string, props: AppParameter) {
    super(scope, id, props);

    const ecsapp = new BLEAEcsAppStack(this, 'BLEAEcsApp', {
      description: 'BLEA ECS App sample for guest accounts (uksb-1tupboc58) (tag:blea-guest-ecs-app-sample-backend)',
      env: {
        account: props.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: props.env?.region || process.env.CDK_DEFAULT_REGION,
      },
      crossRegionReferences: true,
      tags: {
        Repository: 'aws-samples/baseline-environment-on-aws',
        Environment: props.envName,
      },

      // from parameter.ts
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
      vpcCidr: props.vpcCidr,
    });

    const frontend = new BLEAEcsAppFrontendStack(this, 'BLEAEcsFrontend', {
      description: 'BLEA ECS App sample for guest accounts (uksb-1tupboc58) (tag:blea-guest-ecs-app-sample-frontend)',
      env: {
        account: props.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: 'us-east-1',
      },
      crossRegionReferences: true,
      tags: {
        Repository: 'aws-samples/baseline-environment-on-aws',
        Environment: props.envName,
      },

      // from EcsApp stack
      alarmTopic: ecsapp.alarmTopic,
      alb: ecsapp.alb,

      // -- Sample to use custom domain on CloudFront
      // hostedZoneId: props.hostedZoneId,
      // domainName: props.domainName,
      // cloudFrontHostName: props.cloudFrontHostName,
    });

    new BLEAEcsAppMonitoringStack(this, 'BLEAEcsAppMonitoring', {
      description: 'BLEA ECS App sample for guest accounts (uksb-1tupboc58) (tag:blea-guest-ecs-app-sample-monitoring)',
      env: {
        account: props.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: props.env?.region || process.env.CDK_DEFAULT_REGION,
      },
      crossRegionReferences: true,
      tags: {
        Repository: 'aws-samples/baseline-environment-on-aws',
        Environment: props.envName,
      },

      // from parameter.ts
      appEndpoint: frontend.distributionDomainName,
      // -- Sample to use custom domain on CloudFront
      // appEndpoint: `${props.cloudFrontHostName}.${props.domainName}`,
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
    });
  }
}
