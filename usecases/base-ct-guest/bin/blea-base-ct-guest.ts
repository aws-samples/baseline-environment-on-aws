import * as cdk from 'aws-cdk-lib';
import { BLEAIamStack } from '../lib/blea-iam-stack';
import { BLEAConfigRulesStack } from '../lib/blea-config-rules-stack';
import { BLEASecurityAlarmStack } from '../lib/blea-security-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
// import { BLEATrailStack } from '../lib/blea-trail-stack';

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

// ----------------------- Guest Account Base Stacks ------------------------------
new BLEAConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: getProcEnv() });
new BLEAIamStack(app, `${pjPrefix}-Iam`, { env: getProcEnv() });

// AWS CloudTrail configuration in Control Tower Landing Zone v3.0 will not create CloudWatch Logs LogGroup in each Guest Accounts.
// And it will delete these LogGroups when AWS CloudTrial Configuration is disabled in case of updating Landing Zone version from older one.
// BLEA should notify their alarms continuously. So, If there is no CloudTrail and CloudWatch Logs in Guest Account, BLEA creates them to notify the Alarms.

// You should use this code if you match the below condition.
// - You have been using ControlTower Landing Zone before v3.0 and update Landing Zone to v3.0.
//   In addition, AWS CloudTrail configuration is enable.
// -----
const logGroupName = 'aws-controltower/CloudTrailLogs';
// -----

// You should use this code and import blea-trail-stack module if you match one or the other.
// 1. You haven't used previous version. And you start to use ControlTower Landing Zone ver3.0.
// 2. You have already been using ControlTower Landing Zone. And you update Landing Zone to v3.0, but set the AWS CloudTrail configuration disable.
// -----
// const trail = new BLEATrailStack(app, `${pjPrefix}-Trail`, { env: getProcEnv() });
// const logGroupName = trail.cloudTrailLogGroup.logGroupName;
// -----

// Security Alarms
// !!! Need to setup SecurityHub, GuardDuty manually on Organizations Management account
// AWS Config and CloudTrail are set up by ControlTower
const secAlarm = new BLEASecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
  notifyEmail: envVals['securityNotifyEmail'],
  cloudTrailLogGroupName: logGroupName,
  env: getProcEnv(),
});

// Slack Notifier
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdSec = envVals['slackNotifier']['channelIdSec'];
new BLEAChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
  topicArn: secAlarm.alarmTopic.topicArn,
  workspaceId: workspaceId,
  channelId: channelIdSec,
  env: getProcEnv(),
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
