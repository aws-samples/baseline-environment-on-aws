import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { devParameter } from '../parameter';
import { BLEAEcsAppStack } from '../lib/stack/blea-guest-ecs-app-sample-stack';
import { BLEAEcsAppFrontendStack } from '../lib/stack/blea-guest-ecs-app-frontend-stack';
import { BLEAEcsAppMonitoringStack } from '../lib/stack/blea-guest-ecs-app-monitoring-stack';

const app = new App();

const ecsapp = new BLEAEcsAppStack(app, 'Dev-BLEAEcsApp', {
  description: 'BLEA ECS App sample for guest accounts (uksb-1tupboc58) (tag:blea-guest-ecs-app-sample-backend)',
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  // from parameter.ts
  monitoringNotifyEmail: devParameter.monitoringNotifyEmail,
  monitoringSlackWorkspaceId: devParameter.monitoringSlackWorkspaceId,
  monitoringSlackChannelId: devParameter.monitoringSlackChannelId,
  vpcCidr: devParameter.vpcCidr,
});

const frontend = new BLEAEcsAppFrontendStack(app, 'Dev-BLEAEcsAppFrontend', {
  description: 'BLEA ECS App sample for guest accounts (uksb-1tupboc58) (tag:blea-guest-ecs-app-sample-frontend)',
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1', // To use WAFv2 in this Stack
  },
  crossRegionReferences: true,
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  // from EcsApp stack
  alarmTopic: ecsapp.alarmTopic,
  alb: ecsapp.alb,

  // -- Sample to use custom domain on CloudFront
  // -- from parameter.ts
  // hostedZoneId: devParameter.hostedZoneId,
  // domainName: devParameter.domainName,
  // cloudFrontHostName: devParameter.cloudFrontHostName,
});

new BLEAEcsAppMonitoringStack(app, 'Dev-BLEAEcsAppMonitoring', {
  description: 'BLEA ECS App sample for guest accounts (uksb-1tupboc58) (tag:blea-guest-ecs-app-sample-monitoring)',
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  // from parameter.ts
  appEndpoint: frontend.distributionDomainName,
  // -- Sample to use custom domain on CloudFront
  // appEndpoint: `${devParameter.cloudFrontHostName}.${devParameter.domainName}`,
  dashboardName: devParameter.dashboardName,

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
