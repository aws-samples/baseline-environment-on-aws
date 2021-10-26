import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';
import { BLEASecurityAlarmStack } from '../lib/blea-security-alarm-stack';
import { BLEAConfigRulesStack } from '../lib/blea-config-rules-stack';
import { BLEAIamStack } from '../lib/blea-iam-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'BLEA';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('GuestAccount Base Stacks', () => {
    // ----------------------- Guest Account Base Stacks ------------------------------
    const configRule = new BLEAConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: procEnv });
    const iam = new BLEAIamStack(app, `${pjPrefix}-Iam`, { env: procEnv });

    // CloudWatch LogGroup Name for CloudTrail - Created by ControlTower for each account
    const cloudTrailLogGroupName = 'aws-controltower/CloudTrailLogs';

    const secAlarm = new BLEASecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
      notifyEmail: envVals['securityNotifyEmail'],
      cloudTrailLogGroupName: cloudTrailLogGroupName,
      env: procEnv,
    });

    // Slack Notifier
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdSec = envVals['slackNotifier']['channelIdSec'];
    const chatbotSecurity = new BLEAChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
      topicArn: secAlarm.alarmTopic.topicArn,
      workspaceId: workspaceId,
      channelId: channelIdSec,
      env: procEnv,
    });

    // Tagging "Environment" tag to all resources in this app
    const envTagName = 'Environment';
    cdk.Tags.of(app).add(envTagName, envVals['envName']);

    // test with snapshot
    expect(SynthUtils.toCloudFormation(configRule)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(iam)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(secAlarm)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(chatbotSecurity)).toMatchSnapshot();
  });
});
