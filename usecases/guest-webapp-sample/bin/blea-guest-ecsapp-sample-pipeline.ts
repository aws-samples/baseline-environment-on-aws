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
import { BLEAFrontendSimpleStack } from '../lib/blea-frontend-simple-stack';
import { BLEADashboardStack } from '../lib/blea-dashboard-stack';
import { BLEACanaryStack } from '../lib/blea-canary-stack';

import { BLEAPipelineStack } from '../pipeline/blea-ecsapp-sample-pipeline-stack';
import { Construct } from 'constructs';

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

// ----------------------- Pipeline Stage for Guest System Stacks ------------------------------
export class BLEAPipelineStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Slack Notifier
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdMon = envVals['slackNotifier']['channelIdMon'];

    // Topic for monitoring guest system
    const monitorAlarm = new BLEAMonitorAlarmStack(this, `${pjPrefix}-MonitorAlarm`, {
      notifyEmail: envVals['monitoringNotifyEmail'],
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
    });

    new BLEAChatbotStack(this, `${pjPrefix}-ChatbotMonitor`, {
      topicArn: monitorAlarm.alarmTopic.topicArn,
      workspaceId: workspaceId,
      channelId: channelIdMon,
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
    });

    // CMK for Apps
    const appKey = new BLEAKeyAppStack(this, `${pjPrefix}-AppKey`, {
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv()
    });

    // Networking
    const myVpcCidr = envVals['vpcCidr'];
    const prodVpc = new BLEAVpcStack(this, `${pjPrefix}-Vpc`, {
      myVpcCidr: myVpcCidr,
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
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
    const waf = new BLEAWafStack(this, `${pjPrefix}-Waf`, {
      scope: 'REGIONAL',
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
    });

    // Simple CloudFront FrontEnd
    const front = new BLEAFrontendSimpleStack(this, `${pjPrefix}-SimpleFrontStack`, {
      myVpc: prodVpc.myVpc,
      webAcl: waf.webAcl,
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
    });

    // Container Repository
    const ecr = new BLEAECRStack(this, `${pjPrefix}-ECR`, {
      // TODO: will get "repositoryName" from parameters
      repositoryName: 'apprepo',
      alarmTopic: monitorAlarm.alarmTopic,
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
    });

    // Build Container Image
    const build_container = new BLEABuildContainerStack(this, `${pjPrefix}-ContainerImage`, {
      ecrRepository: ecr.repository,
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
    });

    // Application Stack (LoadBalancer + Fargate)
    const ecsApp = new BLEAECSAppStack(this, `${pjPrefix}-ECSApp`, {
      myVpc: prodVpc.myVpc,
      appKey: appKey.kmsKey,
      repository: ecr.repository,
      imageTag: build_container.imageTag,
      alarmTopic: monitorAlarm.alarmTopic,
      webFront: front,
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
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
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
    });

    // Monitoring
    const appCanary = new BLEACanaryStack(this, `${pjPrefix}-ECSAppCanary`, {
      alarmTopic: monitorAlarm.alarmTopic,
      appEndpoint: front.cfDistribution.domainName,
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
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
      // getProcEnv should be called in pipeline layer and do not call this func in stage stack.
      // This is because deployment environment is set in instanciating stage stack.
      // env: getProcEnv(),
    });
  }
}
// --------------------------------- Pipleine  -------------------------------------
// You can deploy development stacks.
new BLEAPipelineStage(app, `${pjPrefix}-Dev-Stage`);

new BLEAPipelineStack(app, `${pjPrefix}-Prod-Pipeline`, {
  githubRepository: envVals['githubRepository'],
  githubTargetBranch: envVals['githubTargetBranchProd'],
  codestarConnectionArn: envVals['codestarConnectionArn'],
  env: {
    account: envVals['toolEnv']['account'],
    region: envVals['toolEnv']['region'],
  },

  deployStage: new BLEAPipelineStage(app, `${pjPrefix}-Prod-Stage-Tool-Account-Deployment`, {
    env: {
      account: envVals['prodEnv']['account'],
      region: envVals['prodEnv']['region'],
    },
  }),
});
new BLEAPipelineStack(app, `${pjPrefix}-Sandbox-Pipeline`, {
  githubRepository: envVals['githubRepository'],
  githubTargetBranch: envVals['githubTargetBranchProd'],
  codestarConnectionArn: envVals['codestarConnectionArn'],
  env: {
    account: envVals['toolEnv']['account'],
    region: envVals['toolEnv']['region'],
  },

  // If yod don't specify env, stacks will be deployed to Tools Account.
  // This is not recommend in multi-account situation in the point of responsibility boundary.
  deployStage: new BLEAPipelineStage(app, `${pjPrefix}-Sandbox-Stage`, {
    env: {
      account: envVals['toolEnv']['account'],
      region: envVals['toolEnv']['region'],
    },
  }),
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(app).add(envTagName, envVals['envName']);
