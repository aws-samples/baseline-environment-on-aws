import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { ABLEChatbotStack } from '../lib/able-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';
import { ABLEMonitorAlarmStack } from '../lib/able-monitor-alarm-stack';
import { ABLEGeneralLogKeyStack } from '../lib/able-generallog-key-stack';
import { ABLEGeneralLogStack } from '../lib/able-generallog-stack';
import { ABLEFlowLogKeyStack } from '../lib/able-flowlog-key-stack';
import { ABLEFlowLogStack } from '../lib/able-flowlog-stack';
import { ABLEVpcStack } from '../lib/able-vpc-stack';
import { ABLEECRStack } from '../lib/able-ecr-stack';
import { ABLEBuildContainerStack } from '../lib/able-build-container-stack';
import { ABLEECSAppStack } from '../lib/able-ecsapp-stack';
import { ABLEDbAuroraPgStack } from '../lib/able-db-aurora-pg-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'ABLE';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Guest Stacks`, () => {
  test('GuestAccount ECS App Stacks', () => {
    // Slack Notifier
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdMon = envVals['slackNotifier']['channelIdMon'];

    // Topic for monitoring guest system
    const monitorAlarm = new ABLEMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
      notifyEmail: envVals['monitoringNotifyEmail'],
      env: procEnv,
    });

    const chatbotMonitor = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
      topicArn: monitorAlarm.alarmTopic.topicArn,
      workspaceId: workspaceId,
      channelId: channelIdMon,
      env: procEnv,
    });

    // CMK for General logs
    const generalLogKey = new ABLEGeneralLogKeyStack(app, `${pjPrefix}-GeneralLogKey`, { env: procEnv });

    // Logging Bucket for General logs
    const generalLog = new ABLEGeneralLogStack(app, `${pjPrefix}-GeneralLog`, {
      kmsKey: generalLogKey.kmsKey,
      env: procEnv,
    });

    // CMK for VPC Flow logs
    const flowLogKey = new ABLEFlowLogKeyStack(app, `${pjPrefix}-FlowlogKey`, { env: procEnv });

    // Logging Bucket for VPC Flow log
    const flowLog = new ABLEFlowLogStack(app, `${pjPrefix}-FlowLog`, {
      kmsKey: flowLogKey.kmsKey,
      env: procEnv,
    });

    // Networking
    const myVpcCidr = envVals['vpcCidr'];
    const prodVpc = new ABLEVpcStack(app, `${pjPrefix}-Vpc`, {
      myVpcCidr: myVpcCidr,
      vpcFlowLogsBucket: flowLog.logBucket,
      env: procEnv,
    });

    // Container Repository
    const ecr = new ABLEECRStack(app, `${pjPrefix}-ECR`, {
      // TODO: will get "repositoryName" from parameters
      repositoryName: 'apprepo',
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });

    // Build Container Image
    const build_container = new ABLEBuildContainerStack(app, `${pjPrefix}-ContainerImage`, {
      ecrRepository: ecr.repository,
      env: procEnv,
    });

    // Application Stack (LoadBalancer + Fargate)
    const ecsApp = new ABLEECSAppStack(app, `${pjPrefix}-ECSApp`, {
      myVpc: prodVpc.myVpc,
      logBucket: generalLog.logBucket,
      appKey: generalLogKey.kmsKey,
      repository: ecr.repository,
      imageTag: build_container.imageTag,
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });
    ecsApp.addDependency(build_container);

    // Aurora
    const dbAuroraPg = new ABLEDbAuroraPgStack(app, `${pjPrefix}-DBAuroraPg`, {
      myVpc: prodVpc.myVpc,
      dbName: 'mydbname',
      dbUser: envVals['dbUser'],
      dbAllocatedStorage: 25,
      vpcSubnets: prodVpc.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      appServerSecurityGroup: ecsApp.appServerSecurityGroup,
      appKey: generalLogKey.kmsKey,
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });

    // Tagging "Environment" tag to all resources in this app
    const envTagName = 'Environment';
    cdk.Tags.of(app).add(envTagName, envVals['envName']);

    // test with snapshot
    expect(SynthUtils.toCloudFormation(chatbotMonitor)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(monitorAlarm)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(generalLogKey)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(generalLog)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(flowLogKey)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(flowLogKey)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(prodVpc)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(ecr)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(build_container)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(ecsApp)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(dbAuroraPg)).toMatchSnapshot();
  });
});
