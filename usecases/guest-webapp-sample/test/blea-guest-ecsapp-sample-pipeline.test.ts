import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as BLEAPipeline from '../pipeline/blea-ecsapp-sample-pipeline-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';

import { BLEAChatbotStack } from '../lib/blea-chatbot-stack';
import { BLEAMonitorAlarmStack } from '../lib/blea-monitor-alarm-stack';
import { BLEAKeyAppStack } from '../lib/blea-key-app-stack';
import { BLEAVpcStack } from '../lib/blea-vpc-stack';
import { BLEAECRStack } from '../lib/blea-ecr-stack';
import { BLEABuildContainerStack } from '../lib/blea-build-container-stack';
import { BLEAECSAppStack } from '../lib/blea-ecsapp-stack';
import { BLEADbAuroraPgStack } from '../lib/blea-db-aurora-pg-stack';
import { BLEAWafStack } from '../lib/blea-waf-stack';
import { BLEAFrontendSimpleStack } from '../lib/blea-frontend-simple-stack';
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

describe(`${pjPrefix} Stacks`, () => {
  test('BLEA Deploy Stack', () => {
    class BLEAPipelineStage extends cdk.Stage {
      constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Slack Notifier
        const workspaceId = envVals['slackNotifier']['workspaceId'];
        const channelIdMon = envVals['slackNotifier']['channelIdMon'];

        // Topic for monitoring guest system
        const monitorAlarm = new BLEAMonitorAlarmStack(this, `${pjPrefix}-MonitorAlarm`, {
          notifyEmail: envVals['monitoringNotifyEmail'],
          env: procEnv,
        });

        new BLEAChatbotStack(this, `${pjPrefix}-ChatbotMonitor`, {
          topicArn: monitorAlarm.alarmTopic.topicArn,
          workspaceId: workspaceId,
          channelId: channelIdMon,
          env: procEnv,
        });

        // CMK for Apps
        const appKey = new BLEAKeyAppStack(this, `${pjPrefix}-AppKey`, { env: procEnv });

        // Networking
        const myVpcCidr = envVals['vpcCidr'];
        const prodVpc = new BLEAVpcStack(this, `${pjPrefix}-Vpc`, {
          myVpcCidr: myVpcCidr,
          env: procEnv,
        });

        // WebACL for ALB
        // Note:
        //   For CloudFront, you can create WebACL with these options.
        //   But currently this code doesn't work. As CDK don't provide cross-stack reference for corss environment.
        //  { scope: 'CLOUDFRONT',
        //    env: {
        //      account: procEnv.account,
        //      region: 'us-east-1',
        //  }}
        const waf = new BLEAWafStack(this, `${pjPrefix}-Waf`, {
          scope: 'REGIONAL',
          env: procEnv,
        });

        // Simple CloudFront FrontEnd
        const front = new BLEAFrontendSimpleStack(this, `${pjPrefix}-SimpleFrontStack`, {
          myVpc: prodVpc.myVpc,
          webAcl: waf.webAcl,
          env: procEnv,
        });

        // Container Repository
        const ecr = new BLEAECRStack(this, `${pjPrefix}-ECR`, {
          // TODO: will get "repositoryName" from parameters
          repositoryName: 'apprepo',
          alarmTopic: monitorAlarm.alarmTopic,
          env: procEnv,
        });

        // Build Container Image
        const build_container = new BLEABuildContainerStack(this, `${pjPrefix}-ContainerImage`, {
          ecrRepository: ecr.repository,
          env: procEnv,
        });

        // Application Stack (LoadBalancer + Fargate)
        const ecsApp = new BLEAECSAppStack(this, `${pjPrefix}-ECSApp`, {
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
        const dbCluster = new BLEADbAuroraPgStack(this, `${pjPrefix}-DBAuroraPg`, {
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
        const appCanary = new BLEACanaryStack(this, `${pjPrefix}-ECSAppCanary`, {
          alarmTopic: monitorAlarm.alarmTopic,
          appEndpoint: front.cfDistribution.domainName,
          env: procEnv,
        });

        new BLEADashboardStack(this, `${pjPrefix}-ECSAppDashboard`, {
          dashboardName: `${pjPrefix}-ECSApp`,
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
      }
    }

    // const devStack = new BLEAPipelineStage(app, `${pjPrefix}-Dev-Stage`);
    const prodStack = new BLEAPipeline.BLEAPipelineStack(app, `${pjPrefix}-Prod-Pipeline`, {
      repository: envVals['repository'],
      branch: envVals['branch'],
      connectionArn: envVals['connectionArn'],
      env: procEnv,
      environment: 'dev',
      deployStage: new BLEAPipelineStage(app, `${pjPrefix}-Prod-Stage`),
    });

    // test with snapshot
    expect(Template.fromStack(prodStack)).toMatchSnapshot();
  });
});
