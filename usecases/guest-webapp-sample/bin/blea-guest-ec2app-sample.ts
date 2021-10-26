#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEAKeyAppStack } from '../lib/blea-key-app-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAInvestigationInstanceStack } from '../lib/blea-investigation-instance-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
import { BLEAEC2AppStack } from '../lib/blea-ec2app-stack';

const pjPrefix = 'BLEA';

const app = new cdk.App();

// ----------------------- Load context variables ------------------------------
// This context need to be specified in args
const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined)
  throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);
const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');

// ----------------------- Environment variables for stack ------------------------------
// Default enviroment
const procEnvDefault = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Define account id and region from context.
// If "env" isn't defined on the environment variable in context, use account and region specified by "--profile".
function getProcEnv() {
  if (envVals['env'] && envVals['env']['account'] && envVals['env']['region']) {
    return { account: envVals['env']['account'], region: envVals['env']['region'] };
  } else {
    return procEnvDefault;
  }
}

// ----------------------- Guest System Stacks ------------------------------

// Slack Notifier
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdMon = envVals['slackNotifier']['channelIdMon'];

// Topic for monitoring guest system
const monitorAlarm = new BLEAMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
  notifyEmail: envVals['monitoringNotifyEmail'],
  env: getProcEnv(),
});

new BLEAChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
  topicArn: monitorAlarm.alarmTopic.topicArn,
  workspaceId: workspaceId,
  channelId: channelIdMon,
  env: getProcEnv(),
});

// CMK for Apps
const appKey = new BLEAKeyAppStack(app, `${pjPrefix}-AppKey`, { env: getProcEnv() });

// Networking
const myVpcCidr = envVals['vpcCidr'];
const prodVpc = new BLEAVpcStack(app, `${pjPrefix}-Vpc`, {
  myVpcCidr: myVpcCidr,
  env: getProcEnv(),
});

// Application Stack (LoadBalancer + EC2 AP Servers)
const ec2App = new BLEAEC2AppStack(app, `${pjPrefix}-EC2App`, {
  myVpc: prodVpc.myVpc,
  appKey: appKey.kmsKey,
  env: getProcEnv(),
});

// Aurora
new BLEADbAuroraPgStack(app, `${pjPrefix}-DBAuroraPg`, {
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
  env: getProcEnv(),
});

// Investigation Instance Stack (EC2)
new BLEAInvestigationInstanceStack(app, `${pjPrefix}-InvestigationInstance`, {
  myVpc: prodVpc.myVpc,
  env: getProcEnv(),
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
