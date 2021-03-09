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

// ----------------------- Load context variables ------------------------------
const environment = app.node.tryGetContext('environment')

if (environment == undefined) throw new Error('Please specify envieonment with context option. ex) cdk deploy -c envonment=dev');

const environment_values = app.node.tryGetContext(environment);

if (environment_values == undefined) throw new Error('Invalid environment.');


// ----------------------- LandingZone Stacks ------------------------------
const secAlarm = new ABLESecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, { notifyEmail: securityNotifyEmail });
cdk.Tags.of(secAlarm).add('Environment', environment_values['environment']);

new ABLEGuarddutyStack(app,`${pjPrefix}-Guardduty`);
new ABLESecurityHubStack(app,`${pjPrefix}-SecurityHub`)
new ABLETrailStack(app,`${pjPrefix}-Trail`, {env: env});

const iam = new ABLEIamStack(app,`${pjPrefix}-Iam`);
cdk.Tags.of(iam).add('Environment', environment_values['environment']);

const config = new ABLEConfigStack(app,`${pjPrefix}-Config`);
cdk.Tags.of(config).add('Environment', environment_values['environment']);

const configRuleCt = new ABLEConfigCtGuardrailStack(app,`${pjPrefix}-ConfigCtGuardrail`);
cdk.Tags.of(configRuleCt).add('Environment', environment_values['environment']);
const configRule = new ABLEConfigRulesStack(app,`${pjPrefix}-ConfigRule`);
cdk.Tags.of(configRule).add('Environment', environment_values['environment']);

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
  notifyEmail: environment_values['monitoringNotifyEmail'],
});
cdk.Tags.of(monitorAlarm).add('Environment', environment_values['environment']);

const chatbotMon = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
  env: env,
  topic: monitorAlarm.alarmTopic,
  workspaceId: workspaceId,
  channelId: channelIdMon,
});


// CMK for General logs
const generalLogKey = new ABLEGeneralLogKeyStack(app,`${pjPrefix}-GeneralLogKey`, {env: env});
cdk.Tags.of(generalLogKey).add('Environment', environment_values['environment']);

// Logging Bucket for General logs
const generalLog = new ABLEGeneralLogStack(app,`${pjPrefix}-GeneralLog`, {
  kmsKey: generalLogKey.kmsKey,
  env: env
});
cdk.Tags.of(generalLog).add('Environment', environment_values['environment']);

// CMK for VPC Flow logs
const flowLogKey = new ABLEFlowLogKeyStack(app,`${pjPrefix}-FlowlogKey`, {env: env});
cdk.Tags.of(flowLogKey).add('Environment', environment_values['environment']);

// Logging Bucket for VPC Flow log
const flowLog = new ABLEFlowLogStack(app,`${pjPrefix}-FlowLog`, {
  kmsKey: flowLogKey.kmsKey,
  env: env
});
cdk.Tags.of(flowLog).add('Environment', environment_values['environment']);


// Networking
const myVpcCidr = environment_values['vpcCidr'];
const prodVpc = new ABLEVpcStack(app,`${pjPrefix}-Vpc`, {
  myVpcCidr: myVpcCidr,
  vpcFlowLogsBucket: flowLog.logBucket,
  env: env
});
cdk.Tags.of(prodVpc).add('Environment', environment_values['environment']);


// Application Stack (LoadBalancer + AutoScaling AP Servers)
const asgApp = new ABLEASGAppStack(app,`${pjPrefix}-ASGApp`, {
  myVpc: prodVpc.myVpc,
  logBucket: generalLog.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env
});
cdk.Tags.of(asgApp).add('Environment', environment_values['environment']);

// Application Stack (LoadBalancer + Fargate)
const ecsApp = new ABLEECSAppStack(app,`${pjPrefix}-ECSApp`, {
  myVpc: prodVpc.myVpc,
  logBucket: generalLog.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic
})
cdk.Tags.of(ecsApp).add('Environment', environment_values['environment']);

// Application Stack (LoadBalancer + EC2 AP Servers)
const ec2App = new ABLEEC2AppStack(app,`${pjPrefix}-EC2App`, {
  myVpc: prodVpc.myVpc,
  logBucket: generalLog.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env
});
cdk.Tags.of(ec2App).add('Environment', environment_values['environment']);


// Aurora
const dbAuroraPg = new ABLEDbAuroraPgStack(app,`${pjPrefix}-DBAuroraPg`, {
  myVpc: prodVpc.myVpc,
  dbName: 'mydbname',
  dbUser: environment_values['dbUser'],
  dbAllocatedStorage: 25, 
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'Protected'
  }),
  appServerSecurityGroup: asgApp.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic,  
});
cdk.Tags.of(dbAuroraPg).add('Environment', environment_values['environment']);

// Aurora Serverless
const dbAuroraPgSl = new ABLEDbAuroraPgSlStack(app,`${pjPrefix}-DBAuroraPgSl`, {
  myVpc: prodVpc.myVpc,
  dbName: 'mydbname',
  dbUser: environment_values['dbUser'],
  dbAllocatedStorage: 25, 
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'Protected'
  }),
  appServerSecurityGroup: asgApp.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic,  
});
cdk.Tags.of(dbAuroraPgSl).add('Environment', environment_values['environment']);



// Investigation Instance Stack (EC2)
const investigationInstance = new ABLEInvestigationInstanceStack(app,`${pjPrefix}-InvestigationInstance`, {
  myVpc: prodVpc.myVpc,
  env: env
});
cdk.Tags.of(investigationInstance).add('Environment', environment_values['environment']);
