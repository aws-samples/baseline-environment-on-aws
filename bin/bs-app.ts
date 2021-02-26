#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { GcIamStack } from '../lib/gc-iam-stack';
import { GcEc2appStack } from '../lib/gc-ec2app-stack';
import { GcEc2appSimpleStack } from '../lib/gc-ec2app-simple-stack';
import { GcConfigRulesStack } from '../lib/gc-config-rules-stack';
import { GcConfigCtGuardrailStack } from '../lib/gc-config-ct-guardrail-stack';
import { GcGuarddutyStack } from '../lib/gc-guardduty-stack';
import { GcTrailStack } from '../lib/gc-trail-stack';
import { GcVpcProdStack } from '../lib/gc-vpc-production-stack';
import { GcFlowLogKeyStack } from '../lib/gc-flowlog-key-stack';
import { GcFlowLogStack } from '../lib/gc-flowlog-stack';
import { GcGeneralLogKeyStack } from '../lib/gc-generallog-key-stack';
import { GcGeneralLogStack } from '../lib/gc-generallog-stack';
import { GcDbStack } from '../lib/gc-db-stack';
import { GcSecurityHubStack } from '../lib/gc-securiy-hub-stack';
import { GcConfigStack } from '../lib/gc-config-stack';
import { GcAlbFargateStack } from '../lib/gc-alb-fargate-stack';
import { GcAuroraServerlessStack } from '../lib/gc-aurora-serverless-stack';
import { GcMonitorAlarmStack } from '../lib/gc-monitor-alarm-stack';
import { GcInvestigationInstanceStack } from '../lib/gc-investigation-instance-stack';
import { GcSecurityAlarmStack } from '../lib/gc-security-alarm-stack';


const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

const securityNotifyEmail = 'notify-security@example.com';
const monitoringNotifyEmail = 'notify-monitoring@example.com';

const app = new cdk.App();

// ----------------------- LandingZone Stacks ------------------------------
const secAlarm = new GcSecurityAlarmStack(app, 'GcSecurityAlarm', { notifyEmail: securityNotifyEmail });
new GcGuarddutyStack(app, 'GcGuardduty');
new GcSecurityHubStack(app, 'GcSecurityHub')
new GcTrailStack(app, 'GcTrail');
new GcIamStack(app, 'GcIam');

const config = new GcConfigStack(app, 'GcConfig');
const configRule = new GcConfigCtGuardrailStack(app, 'GcConfigCtGuardrail');
configRule.addDependency(config);
// new GcConfigRulesStack(app, 'GcConfigRules');  // This is sample rule


// ----------------------- Guest System Stacks ------------------------------
// Topic for monitoring guest system
const monitorAlarm = new GcMonitorAlarmStack(app, 'GcMonitorAlarm', {
  env: env,
  notifyEmail: monitoringNotifyEmail,
});


// CMK for General logs
const generalLogKey = new GcGeneralLogKeyStack(app, 'GcGeneralLogKey', {env: env});

// Logging Bucket for General logs
const generalLogStack = new GcGeneralLogStack(app, 'GcGeneralLog', {
  kmsKey: generalLogKey.kmsKey,
  env: env
});

// CMK for VPC Flow logs
const flowLogKey = new GcFlowLogKeyStack(app, 'GcFlowlogKey', {env: env});

// Logging Bucket for VPC Flow log
const flowLogStack = new GcFlowLogStack(app, 'GcFlowLog', {
  kmsKey: flowLogKey.kmsKey,
  env: env
});


// Networking
const prodVpcCidr = '10.100.0.0/16';
const vpcProdStack = new GcVpcProdStack(app, 'GcVpc', {
  prodVpcCidr: prodVpcCidr,
  vpcFlowLogsBucket: flowLogStack.logBucket,
  env: env
});


// Application Stack (LoadBalancer + AutoScaling AP Servers)
const ec2AppStack = new GcEc2appStack(app, 'GcEc2app', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  logBucket: generalLogStack.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env
});

// Application Stack (LoadBalancer + Fargate)
const albFargateStack = new GcAlbFargateStack(app, 'GcFargate', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  logBucket: generalLogStack.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic
})

// Application Stack (LoadBalancer + EC2 AP Servers)
const ec2AppSimpleStack = new GcEc2appSimpleStack(app, 'GcEc2AppSimple', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  logBucket: generalLogStack.logBucket,
  appKey: generalLogKey.kmsKey,
  env: env
});



// Aurora
const dbStack = new GcDbStack(app, 'GcDb', {
  prodVpc: vpcProdStack.prodVpc,
  dbName: 'mydbname',
  dbUser: 'dbadmin',
  environment: 'dev',
  dbAllocatedStorage: 25, 
  vpcSubnets: vpcProdStack.prodVpc.selectSubnets({
    subnetGroupName: 'Protected'
  }),
  appServerSecurityGroup: ec2AppStack.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic,  
});

// Aurora Serverless
const dbAuroraServerless = new GcAuroraServerlessStack(app, 'GcAuroraServerless', {
  prodVpc: vpcProdStack.prodVpc,
  dbName: 'mydbname',
  dbUser: 'dbadmin',
  environment: 'dev',
  dbAllocatedStorage: 25, 
  vpcSubnets: vpcProdStack.prodVpc.selectSubnets({
    subnetGroupName: 'Protected'
  }),
  appServerSecurityGroup: ec2AppStack.appServerSecurityGroup,
  appKey: generalLogKey.kmsKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic,  
});



// Investigation Instance Stack (EC2)
const investigationInstanceStack = new GcInvestigationInstanceStack(app, 'GcInvestigationInstance', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  env: env
});

