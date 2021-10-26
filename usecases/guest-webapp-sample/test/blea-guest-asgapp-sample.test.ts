import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAKeyAppStack } from '../lib/blea-key-app-stack';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAASGAppStack } from '../lib/blea-asgapp-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'BLEA';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Guest Stacks`, () => {
  test('GuestAccount ASG App Stacks', () => {
    // Slack Notifier
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdMon = envVals['slackNotifier']['channelIdMon'];

    // Topic for monitoring guest system
    const monitorAlarm = new BLEAMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
      notifyEmail: envVals['monitoringNotifyEmail'],
      env: procEnv,
    });

    const chatbotMonitor = new BLEAChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
      topicArn: monitorAlarm.alarmTopic.topicArn,
      workspaceId: workspaceId,
      channelId: channelIdMon,
      env: procEnv,
    });

    // CMK for Apps
    const appKey = new BLEAKeyAppStack(app, `${pjPrefix}-AppKey`, { env: procEnv });

    // Networking
    const myVpcCidr = envVals['vpcCidr'];
    const prodVpc = new BLEAVpcStack(app, `${pjPrefix}-Vpc`, {
      myVpcCidr: myVpcCidr,
      env: procEnv,
    });

    // Application Stack (LoadBalancer + AutoScaling AP Servers)
    const asgApp = new BLEAASGAppStack(app, `${pjPrefix}-ASGApp`, {
      myVpc: prodVpc.myVpc,
      appKey: appKey.kmsKey,
      env: procEnv,
    });

    // Aurora
    const dbAuroraPg = new BLEADbAuroraPgStack(app, `${pjPrefix}-DBAuroraPg`, {
      myVpc: prodVpc.myVpc,
      dbName: 'mydbname',
      dbUser: envVals['dbUser'],
      dbAllocatedStorage: 25,
      vpcSubnets: prodVpc.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      appServerSecurityGroup: asgApp.appServerSecurityGroup,
      appKey: appKey.kmsKey,
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });

    // Tagging "Environment" tag to all resources in this app
    const envTagName = 'Environment';
    cdk.Tags.of(app).add(envTagName, envVals['envName']);

    // test with snapshot
    expect(SynthUtils.toCloudFormation(chatbotMonitor)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(monitorAlarm)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(appKey)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(prodVpc)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(asgApp)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(dbAuroraPg)).toMatchSnapshot();
  });
});
