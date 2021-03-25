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

import { ABLEBuildContainerStack } from '../lib/able-build-container-stack';
import { ABLEECRStack } from '../lib/able-ecr-stack';

const procEnv = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

const pjPrefix ='ABLE';

const app = new cdk.App();

// ----------------------- Load context variables ------------------------------
// This context need to be specified in args
const argContext = 'environment' 

// Environment Key (dev,stage,prod...) 
// Should be defined in 2nd level of "context" tree in cdk.json
const envKey = app.node.tryGetContext(argContext); 
if (envKey == undefined) throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);

// Array of envrionment variables. These values hould be defined in cdk.json or cdk.context.json
const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');


// ----------------------- LandingZone Stacks ------------------------------
const secAlarm = new ABLESecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, { 
  notifyEmail: envVals['securityNotifyEmail'], 
  env: procEnv,
});

new ABLEGuarddutyStack(app,`${pjPrefix}-Guardduty`, {env: procEnv});
new ABLESecurityHubStack(app,`${pjPrefix}-SecurityHub`, {env: procEnv})
new ABLETrailStack(app,`${pjPrefix}-Trail`, {env: procEnv});

const iam = new ABLEIamStack(app,`${pjPrefix}-Iam`, {env: procEnv});
const config = new ABLEConfigStack(app,`${pjPrefix}-Config`, {env: procEnv});

const configRuleCt = new ABLEConfigCtGuardrailStack(app,`${pjPrefix}-ConfigCtGuardrail`, {env: procEnv});
const configRule = new ABLEConfigRulesStack(app,`${pjPrefix}-ConfigRule`, {env: procEnv});
configRuleCt.addDependency(config);
configRule.addDependency(config);

// Slack Notifier
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdSec = envVals['slackNotifier']['channelIdSec'];
const channelIdMon = envVals['slackNotifier']['channelIdMon'];

const chatbotSec = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
  topic: secAlarm.alarmTopic,
  workspaceId: workspaceId,
  channelId: channelIdSec,
  env: procEnv,
});

// ----------------------- Guest System Stacks ------------------------------
// Topic for monitoring guest system
const monitorAlarm = new ABLEMonitorAlarmStack(app,`${pjPrefix}-MonitorAlarm`, {
  notifyEmail: envVals['monitoringNotifyEmail'],
  env: procEnv,
});

const chatbotMon = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
  topic: monitorAlarm.alarmTopic,
  workspaceId: workspaceId,
  channelId: channelIdMon,
  env: procEnv,
});


// CMK for General logs
const generalLogKey = new ABLEGeneralLogKeyStack(app,`${pjPrefix}-GeneralLogKey`, {env: procEnv});

// Logging Bucket for General logs
const generalLog = new ABLEGeneralLogStack(app,`${pjPrefix}-GeneralLog`, {
  kmsKey: generalLogKey.kmsKey,
  env: procEnv
});

// CMK for VPC Flow logs
const flowLogKey = new ABLEFlowLogKeyStack(app,`${pjPrefix}-FlowlogKey`, {env: procEnv});

// Logging Bucket for VPC Flow log
const flowLog = new ABLEFlowLogStack(app,`${pjPrefix}-FlowLog`, {
  kmsKey: flowLogKey.kmsKey,
  env: procEnv
});

// Networking
const myVpcCidr = envVals['vpcCidr'];
const prodVpc = new ABLEVpcStack(app,`${pjPrefix}-Vpc`, {
  myVpcCidr: myVpcCidr,
  vpcFlowLogsBucket: flowLog.logBucket,
  env: procEnv
});

// Application Stack (LoadBalancer + AutoScaling AP Servers)
const asgApp = new ABLEASGAppStack(app,`${pjPrefix}-ASGApp`, {
  myVpc: prodVpc.myVpc,
  logBucket: generalLog.logBucket,
  appKey: generalLogKey.kmsKey,
  env: procEnv
});

// Application Stack (LoadBalancer + EC2 AP Servers)
const ec2App = new ABLEEC2AppStack(app,`${pjPrefix}-EC2App`, {
  myVpc: prodVpc.myVpc,
  logBucket: generalLog.logBucket,
  appKey: generalLogKey.kmsKey,
  env: procEnv
});

// Container Repository
const ecr = new ABLEECRStack(app,`${pjPrefix}-ECR`, {
  // TODO: will get "repositoryName" from parameters
  repositoryName: 'apprepo',
  alarmTopic: monitorAlarm.alarmTopic,
  env: procEnv
});

// Build Container Image
const build_container = new ABLEBuildContainerStack(app, `${pjPrefix}-ContainerImage`, {
  ecrRepository: ecr.repository,
  env: procEnv
});

// Application Stack (LoadBalancer + Fargate)
const ecsApp = new ABLEECSAppStack(app,`${pjPrefix}-ECSApp`, {
  myVpc: prodVpc.myVpc,
  logBucket: generalLog.logBucket,
  appKey: generalLogKey.kmsKey,
  repository: ecr.repository,
  imageTag: build_container.imageTag,
  alarmTopic: monitorAlarm.alarmTopic,
  env: procEnv,
})
ecsApp.addDependency(build_container);

// Aurora
const dbAuroraPg = new ABLEDbAuroraPgStack(app,`${pjPrefix}-DBAuroraPg`, {
  myVpc: prodVpc.myVpc,
  dbName: 'mydbname',
  dbUser: envVals['dbUser'],
  dbAllocatedStorage: 25, 
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'Protected'
  }),
  appServerSecurityGroup: asgApp.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  alarmTopic: monitorAlarm.alarmTopic,  
  env: procEnv,
});

// Aurora Serverless
const dbAuroraPgSl = new ABLEDbAuroraPgSlStack(app,`${pjPrefix}-DBAuroraPgSl`, {
  myVpc: prodVpc.myVpc,
  dbName: 'mydbname',
  dbUser: envVals['dbUser'],
  dbAllocatedStorage: 25, 
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'Protected'
  }),
  appServerSecurityGroup: asgApp.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  alarmTopic: monitorAlarm.alarmTopic,  
  env: procEnv,
});


// Investigation Instance Stack (EC2)
const investigationInstance = new ABLEInvestigationInstanceStack(app,`${pjPrefix}-InvestigationInstance`, {
  myVpc: prodVpc.myVpc,
  env: procEnv
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
