import * as cdk from 'aws-cdk-lib';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEAKeyAppStack } from '../lib/blea-key-app-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAECSAppStack } from '../lib/blea-ecsapp-stack';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
import { BLEABuildContainerStack } from '../lib/blea-build-container-stack';
import { BLEAECRStack } from '../lib/blea-ecr-stack';
import { BLEAWafStack } from '../lib/blea-waf-stack';
import { BLEAFrontendSslStack } from '../lib/blea-frontend-ssl-stack';
import { BLEADashboardStack } from '../lib/blea-dashboard-stack';
import { BLEACanaryStack } from '../lib/blea-canary-stack';

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

// ----------------------- Guest System Stacks ------------------------------

// Slack Notifier
const workspaceId = envVals['slackNotifier']['workspaceId'];
const channelIdMon = envVals['slackNotifier']['channelIdMon'];

// Topic for monitoring guest system
const monitorAlarm = new BLEAMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
  notifyEmail: envVals['monitoringNotifyEmail'],
  env: getProcEnv(),
});

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

// WebACL for ALB
// Note:
//   For CloudFront, you can create WebACL with these options.
//   But currently this code doesn't work. As CDK don't provide cross-stack reference for corss environment.
//  { scope: 'CLOUDFRONT',
//    env: {
//      account: getProcEnv().account,
//      region: 'us-east-1',
//  }}
const waf = new BLEAWafStack(app, `${pjPrefix}-Waf`, {
  scope: 'REGIONAL',
  env: getProcEnv(),
});

// My Domain FrontEnd
const front = new BLEAFrontendSslStack(app, `${pjPrefix}-SSLFrontStack`, {
  myVpc: prodVpc.myVpc,
  hostedZoneId: envVals['hostedZoneId'],
  domainName: envVals['domainName'],
  hostName: envVals['hostName'],
  webAcl: waf.webAcl,
  env: getProcEnv(),
});

// Container Repository
const ecr = new BLEAECRStack(app, `${pjPrefix}-ECR`, {
  // TODO: will get "repositoryName" from parameters
  repositoryName: 'apprepo',
  alarmTopic: monitorAlarm.alarmTopic,
  env: getProcEnv(),
});

// Build Container Image
const build_container = new BLEABuildContainerStack(app, `${pjPrefix}-ContainerImage`, {
  ecrRepository: ecr.repository,
  env: getProcEnv(),
});

// Application Stack (LoadBalancer + Fargate)
const ecsApp = new BLEAECSAppStack(app, `${pjPrefix}-ECSAppSSL`, {
  myVpc: prodVpc.myVpc,
  appKey: appKey.kmsKey,
  repository: ecr.repository,
  imageTag: build_container.imageTag,
  alarmTopic: monitorAlarm.alarmTopic,
  webFront: front,
  env: getProcEnv(),
});
ecsApp.addDependency(build_container);

// Aurora
const dbCluster = new BLEADbAuroraPgStack(app, `${pjPrefix}-DBAuroraPg`, {
  myVpc: prodVpc.myVpc,
  dbName: 'mydbname',
  dbUser: envVals['dbUser'],
  dbAllocatedStorage: 25,
  vpcSubnets: prodVpc.myVpc.selectSubnets({
    subnetGroupName: 'Protected',
  }),
  appServerSecurityGroup: ecsApp.appServerSecurityGroup,
  appKey: appKey.kmsKey,
  alarmTopic: monitorAlarm.alarmTopic,
  env: getProcEnv(),
});

// Monitoring
const appCanary = new BLEACanaryStack(app, `${pjPrefix}-ECSAppSSLCanary`, {
  alarmTopic: monitorAlarm.alarmTopic,
  appEndpoint: [envVals['hostName'], envVals['domainName']].join('.'),
  env: getProcEnv(),
});

new BLEADashboardStack(app, `${pjPrefix}-ECSAppSSLDashboard`, {
  dashboardName: `${pjPrefix}-ECSAppSSL`,
  webFront: front,
  ecsClusterName: ecsApp.ecsClusterName,
  ecsServiceName: ecsApp.ecsServiceName,
  appTargetGroupName: ecsApp.appTargetGroupName,
  dbClusterName: dbCluster.dbClusterName,
  albTgUnHealthyHostCountAlarm: ecsApp.albTgUnHealthyHostCountAlarm,
  ecsScaleOnRequestCount: ecsApp.ecsScaleOnRequestCount,
  ecsTargetUtilizationPercent: ecsApp.ecsTargetUtilizationPercent,
  canaryDurationAlarm: appCanary.canaryDurationAlarm,
  canaryFailedAlarm: appCanary.canaryFailedAlarm,
  env: getProcEnv(),
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
