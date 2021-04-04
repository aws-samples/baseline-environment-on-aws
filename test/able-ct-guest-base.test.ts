import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { ABLEChatbotStack } from '../lib/able-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';
import { ABLESecurityAlarmStack } from '../lib/able-security-alarm-stack';
import { ABLEConfigRulesStack } from '../lib/able-config-rules-stack';
import { ABLEIamStack } from '../lib/able-iam-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'ABLE';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('GuestAccount Base Stacks', () => {
    // ----------------------- Guest Account Base Stacks ------------------------------
    const configRule = new ABLEConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: procEnv });
    const iam = new ABLEIamStack(app, `${pjPrefix}-Iam`, { env: procEnv });

    // Security Alarms
    // !!! Need to setup SecurityHub, GuardDuty, AWS Config, CloudTrail with ControlTower and Organizations Master account
    const secAlarm = new ABLESecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
      notifyEmail: envVals['securityNotifyEmail'],
      env: procEnv,
    });

    // Slack Notifier
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdSec = envVals['slackNotifier']['channelIdSec'];
    const chatbotSecurity = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
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
