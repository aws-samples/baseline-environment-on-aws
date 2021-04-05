#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ABLEChatbotStack } from '../lib/able-chatbot-stack';

const pjPrefix = 'ABLE';
const app = new cdk.App();

// Get Parameters from Context
const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined)
  throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);
const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');

const procEnv = envVals['env']; // contains "account" and "region"
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdAggregate = envVals['slackNotifier']['channelIdAgg'];
const controltowerAuditAccountId = procEnv['account'];
const controltowerHomeRegion = procEnv['region'];

const aggregateTopicArn = `arn:aws:sns:${controltowerHomeRegion}:${controltowerAuditAccountId}:aws-controltower-AggregateSecurityNotifications`;
new ABLEChatbotStack(app, `${pjPrefix}-ChatbotAggregate`, {
  topicArn: aggregateTopicArn,
  workspaceId: workspaceId,
  channelId: channelIdAggregate,
  env: procEnv,
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'audit';
cdk.Tags.of(app).add(envTagName, envTagVal);
