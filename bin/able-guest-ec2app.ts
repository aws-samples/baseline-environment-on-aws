#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ABLEVpcStack } from '../lib/able-vpc-stack';
import { ABLEFlowLogKeyStack } from '../lib/able-flowlog-key-stack';
import { ABLEFlowLogStack } from '../lib/able-flowlog-stack';
import { ABLEGeneralLogKeyStack } from '../lib/able-generallog-key-stack';
import { ABLEGeneralLogStack } from '../lib/able-generallog-stack';
import { ABLEDbAuroraPgStack } from '../lib/able-db-aurora-pg-stack';
import { ABLEMonitorAlarmStack } from '../lib/able-monitor-alarm-stack';
import { ABLEInvestigationInstanceStack } from '../lib/able-investigation-instance-stack';
import { ABLEChatbotStack } from '../lib/able-chatbot-stack';
import { ABLEASGAppStack } from '../lib/able-asgapp-stack';
import { ABLEEC2AppStack } from '../lib/able-ec2app-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'ABLE';

const app = new cdk.App();

// ----------------------- Load context variables ------------------------------
// This context need to be specified in args
const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined)
  throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);
const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');

// ----------------------- Guest System Stacks ------------------------------

// Slack Notifier
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdMon = envVals['slackNotifier']['channelIdMon'];

// Topic for monitoring guest system
const monitorAlarm = new ABLEMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
  notifyEmail: envVals['monitoringNotifyEmail'],
  env: procEnv,
});

new ABLEChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
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

// Application Stack (LoadBalancer + EC2 AP Servers)
const ec2App = new ABLEEC2AppStack(app, `${pjPrefix}-EC2App`, {
  myVpc: prodVpc.myVpc,
  logBucket: generalLog.logBucket,
  appKey: generalLogKey.kmsKey,
  env: procEnv,
});

// Aurora
new ABLEDbAuroraPgStack(app, `${pjPrefix}-DBAuroraPg`, {
  myVpc: prodVpc.myVpc,
  dbName: 'mydbname',
  dbUser: envVals['dbUser'],
  dbAllocatedStorage: 25,
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'Protected',
  }),
  appServerSecurityGroup: ec2App.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  alarmTopic: monitorAlarm.alarmTopic,
  env: procEnv,
});

// Investigation Instance Stack (EC2)
new ABLEInvestigationInstanceStack(app, `${pjPrefix}-InvestigationInstance`, {
  myVpc: prodVpc.myVpc,
  env: procEnv,
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
