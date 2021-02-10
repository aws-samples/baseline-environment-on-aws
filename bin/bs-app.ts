#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { BsIamStack } from '../lib/bs-iam-stack';
import { BsEc2appStack } from '../lib/bs-ec2app-stack';
import { BsEc2appSimpleStack } from '../lib/bs-ec2app-simple-stack';
import { BsConfigRulesStack } from '../lib/bs-config-rules-stack';
import { BsGuarddutyStack } from '../lib/bs-guardduty-stack';
import { BsTrailStack } from '../lib/bs-trail-stack';
import { BsVpcProdStack } from '../lib/bs-vpc-production-stack';
import { bsAppKeyStack } from '../lib/bs-app-key-stack';
import { BsAppLogStack } from '../lib/bs-app-log-stack';
import { BsDbStack } from '../lib/bs-db-stack';


const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

const notifyEmail = 'notify@example.com';

const app = new cdk.App();

// --- LandingZone ---
new BsGuarddutyStack(app, 'bs-guardduty');
new BsTrailStack(app, 'bs-trail', { notifyEmail: notifyEmail });
new BsConfigRulesStack(app, 'bs-config-rules');
new BsIamStack(app, 'bs-iam');


// --- Application Stack ---
// CMK for Encryption
const appKey = new bsAppKeyStack(app, 'bs-app-key-stack', {env: env});

// Logging Bucket and LogGroup for Apps
const appLogStack = new BsAppLogStack(app, 'app-log-stack', {
  appKey: appKey.appKey,
  env: env
});

// Networking
const prodVpcCidr = '10.100.0.0/16';
const vpcProdStack = new BsVpcProdStack(app, 'bs-vpc-prod', {
  prodVpcCidr: prodVpcCidr,
  vpcFlowLogsBucket: appLogStack.logBucket,
  env: env
});

// Application Stack (LoadBalancer + AutoScaling AP Servers)
const ec2AppStack = new BsEc2appStack(app, 'bs-ec2app-stack', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  logBucket: appLogStack.logBucket,
  appKey: appKey.appKey,
  env: env
});

// DB Servers
const dbStack = new BsDbStack(app, 'BsDbStack', {
  prodVpc: vpcProdStack.prodVpc,
  dbName: 'mydbname',
  dbUser: 'dbadmin',
  environment: 'dev',
  dbAllocatedStorage: 25, 
  vpcSubnets: vpcProdStack.prodVpc.selectSubnets({
    subnetGroupName: 'ProdProtectedSubnet'
  }),
  appServerSecurityGroup: ec2AppStack.appServerSecurityGroup,
  appKey: appKey.appKey,
  env: env
});

// Application Stack (LoadBalancer + EC2 AP Servers)
const ec2AppSimpleStack = new BsEc2appSimpleStack(app, 'bs-ec2app-simple-stack', {
  prodVpc: vpcProdStack.prodVpc,
  environment: 'dev',
  logBucket: appLogStack.logBucket,
  appKey: appKey.appKey,
  env: env
});
