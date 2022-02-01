import * as cdk from 'aws-cdk-lib';

import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
import { BLEADbDynamoDbStack } from '../lib/blea-db-dynamodb-stack';
import { BLEALambdaNodejsStack } from '../lib/blea-lambda-nodejs-stack';
import { BLEARestApiStack } from '../lib/blea-restapi-stack';
import { BLEAKeyApiappStack } from '../lib/blea-key-apiapp-stack';

const pjPrefix = 'BLEA';

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

// ----------------------- Guest System Stacks -----------------------------
// Slack Notifier
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdMon = envVals['slackNotifier']['channelIdMon'];

// Topic for monitoring guest system
const monitorAlarm = new BLEAMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
  notifyEmail: envVals['monitoringNotifyEmail'],
  env: getProcEnv(),
});

// Chatbot
new BLEAChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
  topicArn: monitorAlarm.alarmTopic.topicArn,
  workspaceId: workspaceId,
  channelId: channelIdMon,
  env: getProcEnv(),
});

// KMS CMK for Api App
const appKey = new BLEAKeyApiappStack(app, `${pjPrefix}-AppKeyNodejs`, {
  env: getProcEnv(),
});

// DynamoDB
const dynamoDb = new BLEADbDynamoDbStack(app, `${pjPrefix}-DBDynamoDbNodejs`, {
  alarmTopic: monitorAlarm.alarmTopic,
  appKey: appKey.kmsKey,
  env: getProcEnv(),
});
dynamoDb.addDependency(appKey);

// Lambda
const lambda = new BLEALambdaNodejsStack(app, `${pjPrefix}-LambdaNodejs`, {
  alarmTopic: monitorAlarm.alarmTopic,
  table: dynamoDb.table,
  appKey: appKey.kmsKey,
  env: getProcEnv(),
});
lambda.addDependency(dynamoDb);

//REST Api
const restApi = new BLEARestApiStack(app, `${pjPrefix}-RestApiNodejs`, {
  alarmTopic: monitorAlarm.alarmTopic,
  getItemFunction: lambda.getItemFunction,
  listItemsFunction: lambda.listItemsFunction,
  putItemFunction: lambda.putItemFunction,
  env: getProcEnv(),
});
restApi.addDependency(lambda);
// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
