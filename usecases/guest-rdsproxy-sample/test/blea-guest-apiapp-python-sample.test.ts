import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAKeyAppStack } from '../lib/blea-key-app-stack';
import { BLEALambdaPythonStack } from '../lib/blea-lambda-python-stack';
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

    // CMK for Apps
    const appKey = new BLEAKeyAppStack(app, `${pjPrefix}-AppKey`, { env: procEnv });

    // Networking
    const myVpcCidr = envVals['vpcCidr'];
    const prodVpc = new BLEAVpcStack(app, `${pjPrefix}-Vpc`, {
      myVpcCidr: myVpcCidr,
      env: procEnv,
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
      env: procEnv,
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
      dbPort: '5432',
      dbSecurityGroup: dbCluster.dbSecurityGroup,
      appKey: appKey.kmsKey,
      env: procEnv,
    });
    lambda.addDependency(dbCluster);

    //REST Api
    const restApi = new BLEARestApiStack(app, `${pjPrefix}-RestApiPython`, {
      alarmTopic: monitorAlarm.alarmTopic,
      connectFunction: lambda.connectFunction,
      env: procEnv,
    });
    restApi.addDependency(lambda);

    // Tagging "Environment" tag to all resources in this app
    const envTagName = 'Environment';
    cdk.Tags.of(app).add(envTagName, envVals['envName']);

    // Test with snapshot
    expect(Template.fromStack(monitorAlarm)).toMatchSnapshot();
    expect(Template.fromStack(chatbotMonitor)).toMatchSnapshot();
    expect(Template.fromStack(appKey)).toMatchSnapshot();

    expect(Template.fromStack(prodVpc)).toMatchSnapshot();
    expect(Template.fromStack(dbCluster)).toMatchSnapshot();
    expect(Template.fromStack(lambda)).toMatchSnapshot();
    expect(Template.fromStack(restApi)).toMatchSnapshot();
  });
});
