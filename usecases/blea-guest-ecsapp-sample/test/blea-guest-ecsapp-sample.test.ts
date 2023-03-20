import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { devParameter } from '../parameter';
import { BLEAEcsAppSampleStack } from '../lib/stack/blea-guest-ecsapp-sample-stack';
import { BLEAEcsFrontendSampleStack } from '../lib/stack/blea-guest-ecsapp-frontend-stack';
import { BLEAEcsAppMonitoringSampleStack } from '../lib/stack/blea-guest-ecsapp-monitoring-stack';
import { Template } from 'aws-cdk-lib/assertions';

test(`Snapshot test for BLEA ECS App Sample Stacks`, () => {
  const app = new App();

  const ecsapp = new BLEAEcsAppSampleStack(app, 'BLEAEcsAppSampleDev', {
    // from parameter.ts
    monitoringNotifyEmail: devParameter.monitoringNotifyEmail,
    monitoringSlackWorkspaceId: devParameter.monitoringSlackWorkspaceId,
    monitoringSlackChannelId: devParameter.monitoringSlackChannelId,
    vpcCidr: devParameter.vpcCidr,
    hostedZoneId: devParameter.hostedZoneId,
    domainName: devParameter.domainName,
    albHostName: devParameter.albHostName,

    // props of cdk.Stack
    tags: {
      Repository: 'aws-samples/baseline-environment-on-aws',
      Environment: devParameter.envName,
    },
    // Account and Region on test
    //  cdk.process.env.* returns undefined, and cdk.Stack.of(this).* returns ${Token[Region.4]} at test time.
    //  In such case, RegionInfo.get(cdk.Stack.of(this).region) returns error and test will fail.
    //  So we pass 'ap-northeast-1' as region code.
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
    },
    crossRegionReferences: true,
  });

  const frontend = new BLEAEcsFrontendSampleStack(app, 'BLEAEcsFrontendSampleDev', {
    // from parameter.ts
    hostedZoneId: devParameter.hostedZoneId,
    domainName: devParameter.domainName,
    albHostName: devParameter.albHostName,
    cloudFrontHostName: devParameter.cloudFrontHostName,

    // from EcsApp stack
    alarmTopic: ecsapp.alarmTopic,

    // props of cdk.Stack
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'us-east-1',
    },
    crossRegionReferences: true,
  });

  const monitoring = new BLEAEcsAppMonitoringSampleStack(app, 'BLEAEcsMonitoringSampleDev', {
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

    // props of cdk.Stack
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
    },
    crossRegionReferences: true,
  });

  expect(Template.fromStack(ecsapp)).toMatchSnapshot();
  expect(Template.fromStack(frontend)).toMatchSnapshot();
  expect(Template.fromStack(monitoring)).toMatchSnapshot();
});
