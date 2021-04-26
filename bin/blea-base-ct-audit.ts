#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';

const pjPrefix = 'BLEA-BASE';
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

const procEnv = getProcEnv();
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdAggregate = envVals['slackNotifier']['channelIdAgg'];
const controltowerAuditAccountId = procEnv['account'];
const controltowerHomeRegion = procEnv['region'];

const aggregateTopicArn = `arn:aws:sns:${controltowerHomeRegion}:${controltowerAuditAccountId}:aws-controltower-AggregateSecurityNotifications`;
new BLEAChatbotStack(app, `${pjPrefix}-ChatbotAggregate`, {
  topicArn: aggregateTopicArn,
  workspaceId: workspaceId,
  channelId: channelIdAggregate,
  env: getProcEnv(),
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'audit';
cdk.Tags.of(app).add(envTagName, envTagVal);
