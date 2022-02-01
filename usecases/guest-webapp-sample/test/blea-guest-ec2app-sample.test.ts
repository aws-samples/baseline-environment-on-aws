import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAKeyAppStack } from '../lib/blea-key-app-stack';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAInvestigationInstanceStack } from '../lib/blea-investigation-instance-stack';
import { BLEAEC2AppStack } from '../lib/blea-ec2app-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'BLEA';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Guest Stacks`, () => {
  test('GuestAccount EC2 App Stacks', () => {
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

    // Application Stack (LoadBalancer + EC2 AP Servers)
    const ec2App = new BLEAEC2AppStack(app, `${pjPrefix}-EC2App`, {
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
      appServerSecurityGroup: ec2App.appServerSecurityGroup,
      appKey: appKey.kmsKey,
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });

    // Investigation Instance Stack (EC2)
    const investigationInstance = new BLEAInvestigationInstanceStack(app, `${pjPrefix}-InvestigationInstance`, {
      myVpc: prodVpc.myVpc,
      env: procEnv,
    });

    // Tagging "Environment" tag to all resources in this app
    const envTagName = 'Environment';
    cdk.Tags.of(app).add(envTagName, envVals['envName']);

    // test with snapshot
    expect(Template.fromStack(chatbotMonitor)).toMatchSnapshot();
    expect(Template.fromStack(monitorAlarm)).toMatchSnapshot();
    expect(Template.fromStack(appKey)).toMatchSnapshot();
    expect(Template.fromStack(prodVpc)).toMatchSnapshot();
    expect(Template.fromStack(ec2App)).toMatchSnapshot();
    expect(Template.fromStack(dbAuroraPg)).toMatchSnapshot();
    expect(Template.fromStack(investigationInstance)).toMatchSnapshot();
  });
});
