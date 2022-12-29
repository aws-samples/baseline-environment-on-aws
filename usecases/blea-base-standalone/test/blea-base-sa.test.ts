import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { BLEAIamStack } from '../lib/blea-iam-stack';
import { BLEAConfigRulesStack } from '../lib/blea-config-rules-stack';
import { BLEAConfigCtGuardrailStack } from '../lib/blea-config-ct-guardrail-stack';
import { BLEAGuarddutyStack } from '../lib/blea-guardduty-stack';
import { BLEATrailStack } from '../lib/blea-trail-stack';
import { BLEASecurityHubStack } from '../lib/blea-security-hub-stack';
import { BLEAConfigStack } from '../lib/blea-config-stack';
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
    const guardDuty = new BLEAGuarddutyStack(app, `${pjPrefix}-Guardduty`, { env: procEnv });
    const securityHub = new BLEASecurityHubStack(app, `${pjPrefix}-SecurityHub`, { env: procEnv });
    const trail = new BLEATrailStack(app, `${pjPrefix}-Trail`, { env: procEnv });

    const secAlarm = new BLEASecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
      notifyEmail: envVals['securityNotifyEmail'],
      cloudTrailLogGroupName: trail.cloudTrailLogGroup.logGroupName,
      env: procEnv,
    });

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
    expect(Template.fromStack(guardDuty)).toMatchSnapshot();
    expect(Template.fromStack(securityHub)).toMatchSnapshot();
    expect(Template.fromStack(trail)).toMatchSnapshot();
    expect(Template.fromStack(iam)).toMatchSnapshot();
    expect(Template.fromStack(config)).toMatchSnapshot();
    expect(Template.fromStack(configRuleCt)).toMatchSnapshot();
    expect(Template.fromStack(configRule)).toMatchSnapshot();
    expect(Template.fromStack(chatbotForSec)).toMatchSnapshot();
    expect(Template.fromStack(secAlarm)).toMatchSnapshot();
  });
});
