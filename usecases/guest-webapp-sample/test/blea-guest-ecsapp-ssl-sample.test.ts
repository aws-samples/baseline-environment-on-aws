import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAKeyAppStack } from '../lib/blea-key-app-stack';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEAECRStack } from '../lib/blea-ecr-stack';
import { BLEABuildContainerStack } from '../lib/blea-build-container-stack';
import { BLEAECSAppStack } from '../lib/blea-ecsapp-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAWafStack } from '../lib/blea-waf-stack';
import { BLEAFrontendSslStack } from '../lib/blea-frontend-ssl-stack';
import { BLEADashboardStack } from '../lib/blea-dashboard-stack';
import { BLEACanaryStack } from '../lib/blea-canary-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'BLEA';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Guest Stacks`, () => {
  test('GuestAccount ECS App SSL Stacks', () => {
    // Slack Notifier
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdMon = envVals['slackNotifier']['channelIdMon'];

    // Topic for monitoring guest system
    const monitorAlarm = new BLEAMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
      notifyEmail: envVals['monitoringNotifyEmail'],
      env: procEnv,
    });

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

    // WebACL
    const waf = new BLEAWafStack(app, `${pjPrefix}-Waf`, {
      scope: 'REGIONAL',
      env: procEnv,
    });

    // My Domain FrontEnd
    const front = new BLEAFrontendSslStack(app, `${pjPrefix}-SSLFrontStack`, {
      myVpc: prodVpc.myVpc,
      hostedZoneId: envVals['hostedZoneId'],
      domainName: envVals['domainName'],
      hostName: envVals['hostName'],
      webAcl: waf.webAcl,
      env: procEnv,
    });

    // Container Repository
    const ecr = new BLEAECRStack(app, `${pjPrefix}-ECR`, {
      // TODO: will get "repositoryName" from parameters
      repositoryName: 'apprepo',
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });

    // Build Container Image
    const build_container = new BLEABuildContainerStack(app, `${pjPrefix}-ContainerImage`, {
      ecrRepository: ecr.repository,
      env: procEnv,
    });

    // Application Stack (LoadBalancer + Fargate)
    const ecsApp = new BLEAECSAppStack(app, `${pjPrefix}-ECSApp`, {
      myVpc: prodVpc.myVpc,
      appKey: appKey.kmsKey,
      repository: ecr.repository,
      imageTag: build_container.imageTag,
      alarmTopic: monitorAlarm.alarmTopic,
      webFront: front,
      env: procEnv,
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
      env: procEnv,
    });

    // Monitoring
    const appCanary = new BLEACanaryStack(app, `${pjPrefix}-ECSAppSSLCanary`, {
      alarmTopic: monitorAlarm.alarmTopic,
      appEndpoint: [envVals['hostName'], envVals['domainName']].join('.'),
      env: procEnv,
    });

    const dashboard = new BLEADashboardStack(app, `${pjPrefix}-ECSAppSSLDashboard`, {
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
      env: procEnv,
    });

    // Tagging "Environment" tag to all resources in this app
    const envTagName = 'Environment';
    cdk.Tags.of(app).add(envTagName, envVals['envName']);

    // test with snapshot
    expect(Template.fromStack(chatbotMonitor)).toMatchSnapshot();
    expect(Template.fromStack(monitorAlarm)).toMatchSnapshot();
    expect(Template.fromStack(appKey)).toMatchSnapshot();
    expect(Template.fromStack(prodVpc)).toMatchSnapshot();
    expect(Template.fromStack(waf)).toMatchSnapshot();
    expect(Template.fromStack(front)).toMatchSnapshot();
    expect(Template.fromStack(ecr)).toMatchSnapshot();
    expect(Template.fromStack(build_container)).toMatchSnapshot();
    expect(Template.fromStack(ecsApp)).toMatchSnapshot();
    expect(Template.fromStack(dbCluster)).toMatchSnapshot();
    expect(Template.fromStack(appCanary)).toMatchSnapshot();
    expect(Template.fromStack(dashboard)).toMatchSnapshot();
  });
});
