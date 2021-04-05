import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { ABLEIamStack } from '../lib/able-iam-stack';
import { ABLEConfigRulesStack } from '../lib/able-config-rules-stack';
import { ABLEConfigCtGuardrailStack } from '../lib/standalone-base/able-config-ct-guardrail-stack';
import { ABLEGuarddutyStack } from '../lib/standalone-base/able-guardduty-stack';
import { ABLETrailStack } from '../lib/standalone-base/able-trail-stack';
import { ABLESecurityHubStack } from '../lib/standalone-base/able-security-hub-stack';
import { ABLEConfigStack } from '../lib/standalone-base/able-config-stack';
import { ABLESecurityAlarmStack } from '../lib/able-security-alarm-stack';
import { ABLEChatbotStack } from '../lib/able-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'ABLE';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Standalone Stacks`, () => {
  test('GuestAccount Base Stacks', () => {
    const secAlarm = new ABLESecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
      notifyEmail: envVals['securityNotifyEmail'],
      env: procEnv,
    });

    const guardDuty = new ABLEGuarddutyStack(app, `${pjPrefix}-Guardduty`, { env: procEnv });
    const securityHub = new ABLESecurityHubStack(app, `${pjPrefix}-SecurityHub`, { env: procEnv });
    const trail = new ABLETrailStack(app, `${pjPrefix}-Trail`, { env: procEnv });

    const iam = new ABLEIamStack(app, `${pjPrefix}-Iam`, { env: procEnv });
    const config = new ABLEConfigStack(app, `${pjPrefix}-Config`, { env: procEnv });

    const configRuleCt = new ABLEConfigCtGuardrailStack(app, `${pjPrefix}-ConfigCtGuardrail`, { env: procEnv });
    const configRule = new ABLEConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: procEnv });
    configRuleCt.addDependency(config);
    configRule.addDependency(config);

    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdSec = envVals['slackNotifier']['channelIdSec'];

    const chatbotForSec = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
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
