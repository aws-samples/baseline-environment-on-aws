import * as cdk from '@aws-cdk/core';
import { SynthUtils } from '@aws-cdk/assert';

import { ABLEIamStack } from '../lib/able-iam-stack';
import { ABLEASGAppStack } from '../lib/able-asgapp-stack';
import { ABLEEC2AppStack } from '../lib/able-ec2app-stack';
import { ABLEConfigRulesStack } from '../lib/able-config-rules-stack';
import { ABLEConfigCtGuardrailStack } from '../lib/able-config-ct-guardrail-stack';
import { ABLEGuarddutyStack } from '../lib/able-guardduty-stack';
import { ABLETrailStack } from '../lib/able-trail-stack';
import { ABLEVpcStack } from '../lib/able-vpc-stack';
import { ABLEFlowLogKeyStack } from '../lib/able-flowlog-key-stack';
import { ABLEFlowLogStack } from '../lib/able-flowlog-stack';
import { ABLEGeneralLogKeyStack } from '../lib/able-generallog-key-stack';
import { ABLEGeneralLogStack } from '../lib/able-generallog-stack';
import { ABLEDbAuroraPgStack } from '../lib/able-db-aurora-pg-stack';
import { ABLESecurityHubStack } from '../lib/able-security-hub-stack';
import { ABLEConfigStack } from '../lib/able-config-stack';
import { ABLEECSAppStack } from '../lib/able-ecsapp-stack';
import { ABLEDbAuroraPgSlStack } from '../lib/able-db-aurora-pg-sl-stack';
import { ABLEMonitorAlarmStack } from '../lib/able-monitor-alarm-stack';
import { ABLEInvestigationInstanceStack } from '../lib/able-investigation-instance-stack';
import { ABLESecurityAlarmStack } from '../lib/able-security-alarm-stack';
import { ABLEChatbotStack } from '../lib/able-chatbot-stack';
import { ABLEBuildContainerStack } from '../lib/able-build-container-stack';
import { ABLEECRStack } from '../lib/able-ecr-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'ABLE';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Stacks`, () => {
  test('LandingZone Stacks', () => {
    const secAlarm = new ABLESecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
      notifyEmail: envVals['securityNotifyEmail'],
      env: procEnv,
    });

    const guardDuty = new ABLEGuarddutyStack(app, `${pjPrefix}-Guardduty`, { env: procEnv });
    const securityHub = new ABLESecurityHubStack(app, `${pjPrefix}-SecurityHub`, { env: procEnv });
    const trail = new ABLETrailStack(app, `${pjPrefix}-Trail`, { env: procEnv });

    const iam = new ABLEIamStack(app, `${pjPrefix}-Iam`, { env: procEnv });
    const config = new ABLEConfigStack(app, `${pjPrefix}-Config`, { env: procEnv });

    const configRuleCt = new ABLEConfigCtGuardrailStack(app, `${pjPrefix}-ConfigCtGuardrail`, { env: procEnv });
    const configRule = new ABLEConfigRulesStack(app, `${pjPrefix}-ConfigRule`, { env: procEnv });
    configRuleCt.addDependency(config);
    configRule.addDependency(config);

    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdSec = envVals['slackNotifier']['channelIdSec'];

    const chatbotForSec = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotSecurity`, {
      topic: secAlarm.alarmTopic,
      workspaceId: workspaceId,
      channelId: channelIdSec,
      env: procEnv,
    });

    // test with snapshot
    expect(SynthUtils.toCloudFormation(guardDuty)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(securityHub)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(trail)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(iam)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(config)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(configRuleCt)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(configRule)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(chatbotForSec)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(secAlarm)).toMatchSnapshot();
  });

  test('Guest System Stacks', () => {
    const workspaceId = envVals['slackNotifier']['workspaceId'];
    const channelIdMon = envVals['slackNotifier']['channelIdMon'];

    // Topic for monitoring guest system
    const monitorAlarm = new ABLEMonitorAlarmStack(app, `${pjPrefix}-MonitorAlarm`, {
      notifyEmail: envVals['monitoringNotifyEmail'],
      env: procEnv,
    });

    const chatbotForMon = new ABLEChatbotStack(app, `${pjPrefix}-ChatbotMonitor`, {
      topic: monitorAlarm.alarmTopic,
      workspaceId: workspaceId,
      channelId: channelIdMon,
      env: procEnv,
    });

    // CMK for General logs
    const generalLogKey = new ABLEGeneralLogKeyStack(app, `${pjPrefix}-GeneralLogKey`, { env: procEnv });

    // Logging Bucket for General logs
    const generalLog = new ABLEGeneralLogStack(app, `${pjPrefix}-GeneralLog`, {
      kmsKey: generalLogKey.kmsKey,
      env: procEnv,
    });

    // CMK for VPC Flow logs
    const flowLogKey = new ABLEFlowLogKeyStack(app, `${pjPrefix}-FlowlogKey`, { env: procEnv });

    // Logging Bucket for VPC Flow log
    const flowLog = new ABLEFlowLogStack(app, `${pjPrefix}-FlowLog`, {
      kmsKey: flowLogKey.kmsKey,
      env: procEnv,
    });

    // Networking
    const myVpcCidr = envVals['vpcCidr'];
    const prodVpc = new ABLEVpcStack(app, `${pjPrefix}-Vpc`, {
      myVpcCidr: myVpcCidr,
      vpcFlowLogsBucket: flowLog.logBucket,
      env: procEnv,
    });

    // Application Stack (LoadBalancer + AutoScaling AP Servers)
    const asgApp = new ABLEASGAppStack(app, `${pjPrefix}-ASGApp`, {
      myVpc: prodVpc.myVpc,
      logBucket: generalLog.logBucket,
      appKey: generalLogKey.kmsKey,
      env: procEnv,
    });

    // Application Stack (LoadBalancer + EC2 AP Servers)
    const ec2App = new ABLEEC2AppStack(app, `${pjPrefix}-EC2App`, {
      myVpc: prodVpc.myVpc,
      logBucket: generalLog.logBucket,
      appKey: generalLogKey.kmsKey,
      env: procEnv,
    });

    // Container Repository
    const ecr = new ABLEECRStack(app, `${pjPrefix}-ECR`, {
      // TODO: will get "repositoryName" from parameters
      repositoryName: 'apprepo',
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });

    // Build Container Image
    const build_container = new ABLEBuildContainerStack(app, `${pjPrefix}-ContainerImage`, {
      ecrRepository: ecr.repository,
      env: procEnv,
    });

    // Application Stack (LoadBalancer + Fargate)
    const ecsApp = new ABLEECSAppStack(app, `${pjPrefix}-ECSApp`, {
      myVpc: prodVpc.myVpc,
      logBucket: generalLog.logBucket,
      appKey: generalLogKey.kmsKey,
      repository: ecr.repository,
      imageTag: build_container.imageTag,
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });
    ecsApp.addDependency(build_container);

    // Aurora
    const auroraPg = new ABLEDbAuroraPgStack(app, `${pjPrefix}-DBAuroraPg`, {
      myVpc: prodVpc.myVpc,
      dbName: 'mydbname',
      dbUser: envVals['dbUser'],
      dbAllocatedStorage: 25,
      vpcSubnets: prodVpc.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      appServerSecurityGroup: asgApp.appServerSecurityGroup,
      appKey: generalLogKey.kmsKey,
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });

    // Aurora Serverless
    const auroraPgSl = new ABLEDbAuroraPgSlStack(app, `${pjPrefix}-DBAuroraPgSl`, {
      myVpc: prodVpc.myVpc,
      dbName: 'mydbname',
      dbUser: envVals['dbUser'],
      dbAllocatedStorage: 25,
      vpcSubnets: prodVpc.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      appServerSecurityGroup: asgApp.appServerSecurityGroup,
      appKey: generalLogKey.kmsKey,
      alarmTopic: monitorAlarm.alarmTopic,
      env: procEnv,
    });

    // Investigation Instance Stack (EC2)
    const investigtionEc2 = new ABLEInvestigationInstanceStack(app, `${pjPrefix}-InvestigationInstance`, {
      myVpc: prodVpc.myVpc,
      env: procEnv,
    });

    // Tagging "Environment" tag to all resources in this app
    const envTagName = 'Environment';
    cdk.Tags.of(app).add(envTagName, envVals['envName']);

    // test with snapshot
    expect(SynthUtils.toCloudFormation(monitorAlarm)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(chatbotForMon)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(generalLogKey)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(generalLog)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(flowLogKey)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(flowLog)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(prodVpc)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(asgApp)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(ec2App)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(ecr)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(build_container)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(ecsApp)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(auroraPg)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(auroraPgSl)).toMatchSnapshot();
    expect(SynthUtils.toCloudFormation(investigtionEc2)).toMatchSnapshot();
  });
});
