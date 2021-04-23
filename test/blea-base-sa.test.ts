import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { BLEAIamStack } from '../lib/blea-iam-stack';
import { BLEAConfigRulesStack } from '../lib/blea-config-rules-stack';
import { BLEAConfigCtGuardrailStack } from '../lib/standalone-base/blea-config-ct-guardrail-stack';
import { BLEAGuarddutyStack } from '../lib/standalone-base/blea-guardduty-stack';
import { BLEATrailStack } from '../lib/standalone-base/blea-trail-stack';
import { BLEASecurityHubStack } from '../lib/standalone-base/blea-security-hub-stack';
import { BLEAConfigStack } from '../lib/standalone-base/blea-config-stack';
import { BLEASecurityAlarmStack } from '../lib/blea-security-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'BLEA';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Standalone Stacks`, () => {
  test('GuestAccount Base Stacks', () => {
    const secAlarm = new BLEASecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
      notifyEmail: envVals['securityNotifyEmail'],
      env: procEnv,
    });

    const guardDuty = new BLEAGuarddutyStack(app, `${pjPrefix}-Guardduty`, { env: procEnv });
    const securityHub = new BLEASecurityHubStack(app, `${pjPrefix}-SecurityHub`, { env: procEnv });
    const trail = new BLEATrailStack(app, `${pjPrefix}-Trail`, { env: procEnv });

    const iam = new BLEAIamStack(app, `${pjPrefix}-Iam`, { env: procEnv });
    const config = new BLEAConfigStack(app, `${pjPrefix}-Config`, { env: procEnv });

    const configRuleCt = new BLEAConfigCtGuardrailStack(app, `${pjPrefix}-ConfigCtGuardrail`, { env: procEnv });
    const configRule = new BLEAConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: procEnv });
    configRuleCt.addDependency(config);
    configRule.addDependency(config);

    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdSec = envVals['slackNotifier']['channelIdSec'];

    const chatbotForSec = new BLEAChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
      topicArn: secAlarm.alarmTopic.topicArn,
      workspaceId: workspaceId,
      channelId: channelIdSec,
      env: procEnv,
    });

    // test with snapshot
    expect(SynthUtils.toCloudFormation(guardDuty)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(securityHub)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(trail)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(iam)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(config)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(configRuleCt)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(configRule)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(chatbotForSec)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(secAlarm)).toMatchSnapshot();
  });
});
