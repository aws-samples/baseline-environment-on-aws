import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { ABLEChatbotStack } from '../lib/able-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';

const pjPrefix = 'ABLE';
const app = new cdk.App();
const envKey = 'ctaudit';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('AuditAccount Stacks', () => {
    const procEnv = envVals['env']; // contains "account" and "region"
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdAggregate = envVals['slackNotifier']['channelIdAgg'];
    const controltowerAuditAccountId = procEnv['account'];
    const controltowerHomeRegion = procEnv['region'];

    const aggregateTopicArn = `arn:aws:sns:${controltowerHomeRegion}:${controltowerAuditAccountId}:aws-controltower-AggregateSecurityNotifications`;
    const chatbotAggregate = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotAggregate`, {
      topicArn: aggregateTopicArn,
      workspaceId: workspaceId,
      channelId: channelIdAggregate,
      env: procEnv,
    });

    // test with snapshot
    expect(SynthUtils.toCloudFormation(chatbotAggregate)).toMatchSnapshot();
  });
});
