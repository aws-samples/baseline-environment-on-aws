#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { BsIamStack } from '../lib/bs-iam-stack';
import { BsEc2appStack } from '../lib/bs-ec2app-stack';
import { BsConfigRulesStack } from '../lib/bs-config-rules-stack';
import { BsGuarddutyStack } from '../lib/bs-guardduty-stack';
import { BsTrailStack } from '../lib/bs-trail-stack';
import { BsVpcProdStack } from '../lib/bs-vpc-production-stack';
import { bsAppKeyStack } from '../lib/bs-app-key-stack';
import { BsAppLogStack } from '../lib/bs-app-log-stack';


const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};


const app = new cdk.App();

new BsConfigRulesStack(app, 'bs-config-rules');
new BsIamStack(app, 'bs-iam');
// new BsGuarddutyStack(app, 'bs-guardduty');

const notifyEmail = 'notify@example.com';
// const loggingStack = new BsTrailStack(app, 'bs-trail', { notifyEmail: notifyEmail });


const appKey = new bsAppKeyStack(app, 'bs-app-key-stack', {env: env});

const appLogStack = new BsAppLogStack(app, 'app-log-stack', {
  appKey: appKey.appKey,
  env: env
});

const prodVpcCidr = '10.100.0.0/16';
const vpcProdStack = new BsVpcProdStack(app, 'bs-vpc-prod', {
  prodVpcCidr: prodVpcCidr,
  vpcFlowLogsBucket: appLogStack.logBucket,
  env: env
});

const applicatonStack = new BsEc2appStack(app, 'bs-ec2app-stack', {
  prodVpc: vpcProdStack.prodVpc,
  pDBName: 'example',
  pDBUser: 'example',
  pDBPassword: 'pAssw0rd',
  pEnvironment: 'dev',
  pAppInstanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
  pDBClass: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
  pDBAllocatedStorage: 25,
  logBucket: appLogStack.logBucket,
  appKey: appKey.appKey,
  env: env
});


