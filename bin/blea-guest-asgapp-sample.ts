#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEAFlowLogKeyStack } from '../lib/blea-flowlog-key-stack';
import { BLEAFlowLogStack } from '../lib/blea-flowlog-stack';
import { BLEAGeneralLogKeyStack } from '../lib/blea-generallog-key-stack';
import { BLEAGeneralLogStack } from '../lib/blea-generallog-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
import { BLEAASGAppStack } from '../lib/blea-asgapp-stack';

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

// CMK for General logs
const generalLogKey = new BLEAGeneralLogKeyStack(app, `${pjPrefix}-GeneralLogKey`, { env: getProcEnv() });

// Logging Bucket for General logs
const generalLog = new BLEAGeneralLogStack(app, `${pjPrefix}-GeneralLog`, {
  kmsKey: generalLogKey.kmsKey,
  env: getProcEnv(),
});

// CMK for VPC Flow logs
const flowLogKey = new BLEAFlowLogKeyStack(app, `${pjPrefix}-FlowlogKey`, { env: getProcEnv() });

// Logging Bucket for VPC Flow log
const flowLog = new BLEAFlowLogStack(app, `${pjPrefix}-FlowLog`, {
  kmsKey: flowLogKey.kmsKey,
  env: getProcEnv(),
});

// Networking
const myVpcCidr = envVals['vpcCidr'];
const prodVpc = new BLEAVpcStack(app, `${pjPrefix}-Vpc`, {
  myVpcCidr: myVpcCidr,
  vpcFlowLogsBucket: flowLog.logBucket,
  env: getProcEnv(),
});

// Application Stack (LoadBalancer + AutoScaling AP Servers)
const asgApp = new BLEAASGAppStack(app, `${pjPrefix}-ASGApp`, {
  myVpc: prodVpc.myVpc,
  logBucket: generalLog.logBucket,
  appKey: generalLogKey.kmsKey,
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
  appServerSecurityGroup: asgApp.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  alarmTopic: monitorAlarm.alarmTopic,
  env: getProcEnv(),
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
