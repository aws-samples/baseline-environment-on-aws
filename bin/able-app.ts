#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ABLEIamStack } from '../lib/able-iam-stack';
import { ABLEASGAppStack } from '../lib/able-asgapp-stack';
import { ABLEEC2AppStack } from '../lib/able-ec2app-stack';
import { ABLEConfigRulesStack } from '../lib/able-config-rules-stack';
import { ABLEConfigCtGuardrailStack } from '../lib/able-config-ct-guardrail-stack';
import { ABLEGuarddutyStack } from '../lib/able-guardduty-stack';
import { ABLETrailStack } from '../lib/able-trail-stack';
import { ABLEVpcStack } from '../lib/able-vpc-stack';
import { ABLEFlowLogKeyStack } from '../lib/able-flowlog-key-stack';
import { ABLEFlowLogStack } from '../lib/able-flowlog-stack';
import { ABLEGeneralLogKeyStack } from '../lib/able-generallog-key-stack';
import { ABLEGeneralLogStack } from '../lib/able-generallog-stack';
import { ABLEDbAuroraPgStack } from '../lib/able-db-aurora-pg-stack';
import { ABLESecurityHubStack } from '../lib/able-security-hub-stack';
import { ABLEConfigStack } from '../lib/able-config-stack';
import { ABLEECSAppStack } from '../lib/able-ecsapp-stack';
import { ABLEDbAuroraPgSlStack } from '../lib/able-db-aurora-pg-sl-stack';
import { ABLEMonitorAlarmStack } from '../lib/able-monitor-alarm-stack';
import { ABLEInvestigationInstanceStack } from '../lib/able-investigation-instance-stack';
import { ABLESecurityAlarmStack } from '../lib/able-security-alarm-stack';
import { ABLEChatbotStack } from '../lib/able-chatbot-stack';


const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

const pjPrefix ='ABLE';

const securityNotifyEmail = 'notify-security@example.com';
const monitoringNotifyEmail = 'notify-monitoring@example.com';

const app = new cdk.App();

// ----------------------- LandingZone Stacks ------------------------------
const secAlarm = new ABLESecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, { notifyEmail: securityNotifyEmail });
new ABLEGuarddutyStack(app,`${pjPrefix}-Guardduty`);
new ABLESecurityHubStack(app,`${pjPrefix}-SecurityHub`)
new ABLETrailStack(app,`${pjPrefix}-Trail`, {env: env});
new ABLEIamStack(app,`${pjPrefix}-Iam`);

const config = new ABLEConfigStack(app,`${pjPrefix}-Config`);
const configRuleCt = new ABLEConfigCtGuardrailStack(app,`${pjPrefix}-ConfigCtGuardrail`);
const configRule = new ABLEConfigRulesStack(app,`${pjPrefix}-ConfigRule`);
configRuleCt.addDependency(config);
configRule.addDependency(config);

// Slack Notifier
const workspaceId = 'T8XXXXXXX';     // Copy from AWS Chatbot Workspace details
const channelIdSec = 'C01XXXXXXXX';  // Copy from Your Slack App - Security Alarms
const channelIdMon = 'C01YYYYYYYY';  // Copy from Your Slack App - Monitoring Alarms

const chatbotSec = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
  topic: secAlarm.alarmTopic,
  workspaceId: workspaceId,
  channelId: channelIdSec,
});

// ----------------------- Guest System Stacks ------------------------------
// Topic for monitoring guest system
const monitorAlarm = new ABLEMonitorAlarmStack(app,`${pjPrefix}-MonitorAlarm`, {
  env: env,
  notifyEmail: monitoringNotifyEmail,
});

const chatbotMon = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
  env: env,
  topic: monitorAlarm.alarmTopic,
  workspaceId: workspaceId,
  channelId: channelIdMon,
});


// CMK for General logs
const generalLogKey = new ABLEGeneralLogKeyStack(app,`${pjPrefix}-GeneralLogKey`, {env: env});

// Logging Bucket for General logs
const generalLogStack = new ABLEGeneralLogStack(app,`${pjPrefix}-GeneralLog`, {
  kmsKey: generalLogKey.kmsKey,
  env: env
});

// CMK for VPC Flow logs
const flowLogKey = new ABLEFlowLogKeyStack(app,`${pjPrefix}-FlowlogKey`, {env: env});

// Logging Bucket for VPC Flow log
const flowLogStack = new ABLEFlowLogStack(app,`${pjPrefix}-FlowLog`, {
  kmsKey: flowLogKey.kmsKey,
  env: env
});


// Networking
const myVpcCidr = '10.100.0.0/16';
const prodVpc = new ABLEVpcStack(app,`${pjPrefix}-Vpc`, {
  myVpcCidr: myVpcCidr,
  vpcFlowLogsBucket: flowLogStack.logBucket,
  env: env
});


// Application Stack (LoadBalancer + AutoScaling AP Servers)
const asgApp = new ABLEASGAppStack(app,`${pjPrefix}-ASGApp`, {
  myVpc: prodVpc.myVpc,
  environment: 'dev',
  logBucket: generalLogStack.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env
});

// Application Stack (LoadBalancer + Fargate)
const ecsApp = new ABLEECSAppStack(app,`${pjPrefix}-ECSApp`, {
  myVpc: prodVpc.myVpc,
  environment: 'dev',
  logBucket: generalLogStack.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic
})

// Application Stack (LoadBalancer + EC2 AP Servers)
const ec2App = new ABLEEC2AppStack(app,`${pjPrefix}-EC2App`, {
  myVpc: prodVpc.myVpc,
  environment: 'dev',
  logBucket: generalLogStack.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env
});



// Aurora
const dbAuroraPg = new ABLEDbAuroraPgStack(app,`${pjPrefix}-DBAuroraPg`, {
  myVpc: prodVpc.myVpc,
  dbName: 'mydbname',
  dbUser: 'dbadmin',
  environment: 'dev',
  dbAllocatedStorage: 25, 
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'Protected'
  }),
  appServerSecurityGroup: asgApp.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic,  
});

// Aurora Serverless
const dbAuroraPgSl = new ABLEDbAuroraPgSlStack(app,`${pjPrefix}-DBAuroraPgSl`, {
  myVpc: prodVpc.myVpc,
  dbName: 'mydbname',
  dbUser: 'dbadmin',
  environment: 'dev',
  dbAllocatedStorage: 25, 
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'Protected'
  }),
  appServerSecurityGroup: asgApp.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic,  
});



// Investigation Instance Stack (EC2)
const investigationInstanceStack = new ABLEInvestigationInstanceStack(app,`${pjPrefix}-InvestigationInstance`, {
  myVpc: prodVpc.myVpc,
  environment: 'dev',
  env: env
});

