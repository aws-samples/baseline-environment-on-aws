import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { devParameter } from '../parameter';
import { BLEAEcsAppStack } from '../lib/stack/blea-guest-ecs-app-sample-stack';
import { BLEAEcsAppFrontendStack } from '../lib/stack/blea-guest-ecs-app-frontend-stack';
import { BLEAEcsAppMonitoringStack } from '../lib/stack/blea-guest-ecs-app-monitoring-stack';

const app = new App();

const ecsapp = new BLEAEcsAppStack(app, 'Dev-BLEAEcsApp', {
  env: devParameter.env,
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
  hostedZoneId: devParameter.hostedZoneId,
  domainName: devParameter.domainName,
  albHostName: devParameter.albHostName,
});

const frontend = new BLEAEcsAppFrontendStack(app, 'Dev-BLEAEcsAppFrontend', {
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  crossRegionReferences: true,
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  // from parameter.ts
  hostedZoneId: devParameter.hostedZoneId,
  domainName: devParameter.domainName,
  albHostName: devParameter.albHostName,
  cloudFrontHostName: devParameter.cloudFrontHostName,

  // from EcsApp stack
  alarmTopic: ecsapp.alarmTopic,
});

new BLEAEcsAppMonitoringStack(app, 'Dev-BLEAEcsAppMonitoring', {
  env: devParameter.env,
  crossRegionReferences: true,
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  // from parameter.ts
  appEndpoint: `${devParameter.cloudFrontHostName}.${devParameter.domainName}`,
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
