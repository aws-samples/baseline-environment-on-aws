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

// ----------------------- Guest Account Base Stacks ------------------------------
new ABLEConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: procEnv });
new ABLEIamStack(app, `${pjPrefix}-Iam`, { env: procEnv });

// Security Alarms
// !!! Need to setup SecurityHub, GuardDuty, AWS Config, CloudTrail with ControlTower and Organizations Master account
const secAlarm = new ABLESecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
  notifyEmail: envVals['securityNotifyEmail'],
  env: procEnv,
});

// Slack Notifier
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdSec = envVals['slackNotifier']['channelIdSec'];
new ABLEChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
  topicArn: secAlarm.alarmTopic.topicArn,
  workspaceId: workspaceId,
  channelId: channelIdSec,
  env: procEnv,
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
