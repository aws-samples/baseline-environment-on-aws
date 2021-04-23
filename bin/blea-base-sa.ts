#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { BLEAConfigCtGuardrailStack } from '../lib/standalone-base/blea-config-ct-guardrail-stack';
import { BLEAGuarddutyStack } from '../lib/standalone-base/blea-guardduty-stack';
import { BLEATrailStack } from '../lib/standalone-base/blea-trail-stack';
import { BLEASecurityHubStack } from '../lib/standalone-base/blea-security-hub-stack';
import { BLEAConfigStack } from '../lib/standalone-base/blea-config-stack';
import { BLEAIamStack } from '../lib/blea-iam-stack';
import { BLEAConfigRulesStack } from '../lib/blea-config-rules-stack';
import { BLEASecurityAlarmStack } from '../lib/blea-security-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'BLEA';

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
const secAlarm = new BLEASecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
  notifyEmail: envVals['securityNotifyEmail'],
  env: procEnv,
});

new BLEAGuarddutyStack(app, `${pjPrefix}-Guardduty`, { env: procEnv });
new BLEASecurityHubStack(app, `${pjPrefix}-SecurityHub`, { env: procEnv });
new BLEATrailStack(app, `${pjPrefix}-Trail`, { env: procEnv });

new BLEAIamStack(app, `${pjPrefix}-Iam`, { env: procEnv });
const config = new BLEAConfigStack(app, `${pjPrefix}-Config`, { env: procEnv });

const configRuleCt = new BLEAConfigCtGuardrailStack(app, `${pjPrefix}-ConfigCtGuardrail`, { env: procEnv });
const configRule = new BLEAConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: procEnv });
configRuleCt.addDependency(config);
configRule.addDependency(config);

// Slack Notifier
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdSec = envVals['slackNotifier']['channelIdSec'];

new BLEAChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
  topicArn: secAlarm.alarmTopic.topicArn,
  workspaceId: workspaceId,
  channelId: channelIdSec,
  env: procEnv,
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
