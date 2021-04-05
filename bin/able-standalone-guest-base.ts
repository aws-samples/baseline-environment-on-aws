#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ABLEConfigCtGuardrailStack } from '../lib/standalone-base/able-config-ct-guardrail-stack';
import { ABLEGuarddutyStack } from '../lib/standalone-base/able-guardduty-stack';
import { ABLETrailStack } from '../lib/standalone-base/able-trail-stack';
import { ABLESecurityHubStack } from '../lib/standalone-base/able-security-hub-stack';
import { ABLEConfigStack } from '../lib/standalone-base/able-config-stack';
import { ABLEIamStack } from '../lib/able-iam-stack';
import { ABLEConfigRulesStack } from '../lib/able-config-rules-stack';
import { ABLESecurityAlarmStack } from '../lib/able-security-alarm-stack';
import { ABLEChatbotStack } from '../lib/able-chatbot-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'ABLE';

const app = new cdk.App();

// ----------------------- Load context variables ------------------------------
// This context need to be specified in args
const argContext = 'environment';

// Environment Key (dev,stage,prod...)
// Should be defined in 2nd level of "context" tree in cdk.json
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined)
  throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);

// Array of envrionment variables. These values hould be defined in cdk.json or cdk.context.json
const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');

// ---------------- Governance Base Stacks for this account --------------------------
const secAlarm = new ABLESecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
  notifyEmail: envVals['securityNotifyEmail'],
  env: procEnv,
});

new ABLEGuarddutyStack(app, `${pjPrefix}-Guardduty`, { env: procEnv });
new ABLESecurityHubStack(app, `${pjPrefix}-SecurityHub`, { env: procEnv });
new ABLETrailStack(app, `${pjPrefix}-Trail`, { env: procEnv });

new ABLEIamStack(app, `${pjPrefix}-Iam`, { env: procEnv });
const config = new ABLEConfigStack(app, `${pjPrefix}-Config`, { env: procEnv });

const configRuleCt = new ABLEConfigCtGuardrailStack(app, `${pjPrefix}-ConfigCtGuardrail`, { env: procEnv });
const configRule = new ABLEConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: procEnv });
configRuleCt.addDependency(config);
configRule.addDependency(config);

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
