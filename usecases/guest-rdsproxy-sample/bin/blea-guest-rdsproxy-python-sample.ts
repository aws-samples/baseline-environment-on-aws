#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
import { BLEAKeyAppStack } from '../lib/blea-key-app-stack';
import { setupLambdaLayerPython } from '../lib/blea-setup-lambda-layer-python';
import { BLEALambdaPythonStack } from '../lib/blea-lambda-python-stack';
import { BLEARestApiStack } from '../lib/blea-restapi-stack';

// Setup Lambda Layer Modules
setupLambdaLayerPython();

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

// CMK for Apps
const appKey = new BLEAKeyAppStack(app, `${pjPrefix}-AppKey`, { env: getProcEnv() });

// Networking
const myVpcCidr = envVals['vpcCidr'];
const prodVpc = new BLEAVpcStack(app, `${pjPrefix}-Vpc`, {
  myVpcCidr: myVpcCidr,
  env: getProcEnv(),
});

// Aurora + Proxy
const dbCluster = new BLEADbAuroraPgStack(app, `${pjPrefix}-DBAuroraPg`, {
  myVpc: prodVpc.myVpc,
  dbName: envVals['dbName'],
  dbUser: envVals['dbUser'],
  dbAllocatedStorage: 25,
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'ProtectedAurora',
  }),
  appKey: appKey.kmsKey,
  alarmTopic: monitorAlarm.alarmTopic,
  env: getProcEnv(),
});
dbCluster.addDependency(prodVpc);

// Lambda
const lambda = new BLEALambdaPythonStack(app, `${pjPrefix}-LambdaPython`, {
  alarmTopic: monitorAlarm.alarmTopic,
  myVpc: prodVpc.myVpc,
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'ProtectedLambda',
  }),
  dbUser: envVals['dbUser'],
  dbName: envVals['dbName'],
  dbProxy: dbCluster.dbProxy,
  dbPort: '5432', // for PostgreSQL
  // dbPort: '3306', // for MySQL
  dbSecurityGroup: dbCluster.dbSecurityGroup,
  appKey: appKey.kmsKey,
  env: getProcEnv(),
});
lambda.addDependency(dbCluster);

//REST Api
const restApi = new BLEARestApiStack(app, `${pjPrefix}-RestApiPython`, {
  alarmTopic: monitorAlarm.alarmTopic,
  connectFunction: lambda.connectFunction,
  env: getProcEnv(),
});
restApi.addDependency(lambda);
// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
