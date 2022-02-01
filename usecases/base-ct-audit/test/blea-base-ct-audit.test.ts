import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';

const pjPrefix = 'BLEA';
const app = new cdk.App();
const envKey = 'dev-audit';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('AuditAccount Stacks', () => {
    const procEnv = envVals['env']; // contains "account" and "region"
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdAggregate = envVals['slackNotifier']['channelIdAgg'];
    const controltowerAuditAccountId = procEnv['account'];
    const controltowerHomeRegion = procEnv['region'];

    const aggregateTopicArn = `arn:aws:sns:${controltowerHomeRegion}:${controltowerAuditAccountId}:aws-controltower-AggregateSecurityNotifications`;
    const chatbotAggregate = new BLEAChatbotStack(app, `${pjPrefix}-ChatbotAggregate`, {
      topicArn: aggregateTopicArn,
      workspaceId: workspaceId,
      channelId: channelIdAggregate,
      env: procEnv,
    });

    // test with snapshot
    expect(Template.fromStack(chatbotAggregate)).toMatchSnapshot();
  });
});
