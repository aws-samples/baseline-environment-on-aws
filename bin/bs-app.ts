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
import { GcAppKeyStack } from '../lib/gc-app-key-stack';
import { GcAppLogStack } from '../lib/gc-app-log-stack';
import { GcDbStack } from '../lib/gc-db-stack';
import { GcSecurityHubStack } from '../lib/gc-securiy-hub-stack';
import { GcConfigStack } from '../lib/gc-config-stack';
import { GcAlbFargateStack } from '../lib/gc-alb-fargate-stack';
import { GcAuroraServerlessStack } from '../lib/gc-aurora-serverless-stack';
import { GcMemberAlertStack } from '../lib/gc-member-alert-stack';
import { GcMonitorAlarmStack } from '../lib/gc-monitor-alarm-stack';
import { GcInvestigationInstanceStack } from '../lib/gc-investigation-instance-stack';


const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

const notifyEmail = 'notify@example.com';

const app = new cdk.App();

// --- LandingZone ---
new GcGuarddutyStack(app, 'GcGuardduty');
new GcSecurityHubStack(app, 'GcSecurityHub')
new GcTrailStack(app, 'GcTrail', { notifyEmail: notifyEmail });
new GcIamStack(app, 'GcIam');

const config = new GcConfigStack(app, 'GcConfig');
const configRule = new GcConfigCtGuardrailStack(app, 'GcConfigCtGuardrail');
configRule.addDependency(config);
// new GcConfigRulesStack(app, 'GcConfigRules');  // This is sample rule



// --- Application Stack ---
// CMK for Encryption
const appKey = new GcAppKeyStack(app, 'GcAppKey', {env: env});

// Logging Bucket and LogGroup for Apps
const appLogStack = new GcAppLogStack(app, 'GcAppLog', {
  appKey: appKey.appKey,
  env: env
});

const monitorAlarm = new GcMonitorAlarmStack(app, 'GcMonitorAlarm', {
  env: env,
  notifyEmail: notifyEmail
});


// Networking
const prodVpcCidr = '10.100.0.0/16';
const vpcProdStack = new GcVpcProdStack(app, 'GcVpc', {
  prodVpcCidr: prodVpcCidr,
  vpcFlowLogsBucket: appLogStack.logBucket,
  env: env
});

// Application Stack (LoadBalancer + AutoScaling AP Servers)
const ec2AppStack = new GcEc2appStack(app, 'GcEc2app', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  logBucket: appLogStack.logBucket,
  appKey: appKey.appKey,
  env: env
});

// Application Stack (LoadBalancer + Fargate)
const albFargateStack = new GcAlbFargateStack(app, 'GcFargate', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  logBucket: appLogStack.logBucket,
  appKey: appKey.appKey,
  env: env,
  alarmTopic: monitorAlarm.alarmTopic
})

// Application Stack (LoadBalancer + EC2 AP Servers)
const ec2AppSimpleStack = new GcEc2appSimpleStack(app, 'GcEc2AppSimple', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  logBucket: appLogStack.logBucket,
  appKey: appKey.appKey,
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
  appKey: appKey.appKey,
  env: env
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
  appKey: appKey.appKey,
  env: env
});



// Investigation Instance Stack (EC2)
const investigationInstanceStack = new GcInvestigationInstanceStack(app, 'GcInvestigationInstance', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  env: env
});

