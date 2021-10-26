import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
import { BLEAKeyApiappStack } from '../lib/blea-key-apiapp-stack';
import { BLEADbDynamoDbStack } from '../lib/blea-db-dynamodb-stack';
import { BLEALambdaNodejsStack } from '../lib/blea-lambda-nodejs-stack';
import { BLEARestApiStack } from '../lib/blea-restapi-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'BLEA';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Guest Stack`, () => {
  test('GuestAccount Serverless App Stacks', () => {
    // Slack Notifier
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdMon = envVals['slackNotifier']['channelIdMon'];

    // Topic for monitoring guest system
    const monitorAlarm = new BLEAMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
      notifyEmail: envVals['monitoringNotifyEmail'],
      env: procEnv,
    });

    // Chatbot
    const chatbotMonitor = new BLEAChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
      topicArn: monitorAlarm.alarmTopic.topicArn,
      workspaceId: workspaceId,
      channelId: channelIdMon,
      env: procEnv,
    });

    // KMS CMK for Api App
    const appKey = new BLEAKeyApiappStack(app, `${pjPrefix}-AppKeyNodejs`, {
      env: procEnv,
    });

    // DynamoDB
    const dynamoDb = new BLEADbDynamoDbStack(app, `${pjPrefix}-DBDynamoDb`, {
      alarmTopic: monitorAlarm.alarmTopic,
      appKey: appKey.kmsKey,
      env: procEnv,
    });
    dynamoDb.addDependency(appKey);

    // Lambda
    const lambda = new BLEALambdaNodejsStack(app, `${pjPrefix}-LambdaNodejs`, {
      alarmTopic: monitorAlarm.alarmTopic,
      table: dynamoDb.table,
      appKey: appKey.kmsKey,
      env: procEnv,
    });
    lambda.addDependency(dynamoDb);

    //REST Api
    const restApi = new BLEARestApiStack(app, `${pjPrefix}-RestApi`, {
      alarmTopic: monitorAlarm.alarmTopic,
      getItemFunction: lambda.getItemFunction,
      listItemsFunction: lambda.listItemsFunction,
      putItemFunction: lambda.putItemFunction,
      env: procEnv,
    });
    restApi.addDependency(lambda);

    // Tagging "Environment" tag to all resources in this app
    const envTagName = 'Environment';
    cdk.Tags.of(app).add(envTagName, envVals['envName']);

    // Test with snapshot
    expect(SynthUtils.toCloudFormation(monitorAlarm)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(chatbotMonitor)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(appKey)).toMatchSnapshot();

    expect(SynthUtils.toCloudFormation(dynamoDb)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(lambda)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(restApi)).toMatchSnapshot();
  });
});
