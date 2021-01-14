#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { NiscIamStack } from '../lib/nisc-iam-stack';
import { NiscApplicationStack } from '../lib/nisc-application-stack';
import { NiscConfigRulesStack } from '../lib/nisc-config-rules-stack';
import { NiscGuarddutyStack } from '../lib/nisc-guardduty-stack';
import { NiscLoggingStack } from '../lib/nisc-logging-stack';
import { NiscVpcProductionStack } from '../lib/nisc-vpc-production-stack';
import { NiscVpcManagementStack } from '../lib/nisc-vpc-management-stack';
import { NiscVpcPeeringStack } from '../lib/nisc-vpc-peering-stack';


const app = new cdk.App();

new NiscConfigRulesStack(app, 'nisc-config-rules');
new NiscIamStack(app, 'nisc-iam');
//new NiscGuarddutyStack(app, 'nisc-guardduty');

const notifyEmail = 'notify@example.com';
new NiscLoggingStack(app, 'nisc-logging', { notifyEmail: notifyEmail });

const prodVpcCidr = '10.100.0.0/16';
const vpcProdStack = new NiscVpcProductionStack(app, 'nisc-vpc-prod', {
  prodVpcCidr: prodVpcCidr
});

const mgmtVpcCidr = '10.10.0.0/16';
const vpcMgmtStack = new NiscVpcManagementStack(app, 'nisc-vpc-mgmt', {
  mgmtVpcCidr: mgmtVpcCidr
});

const peeringStack = new NiscVpcPeeringStack(app, 'nisc-peering-stack', {
  srcVpcId: vpcProdStack.prodVpcId,
  srcVpcCidr: prodVpcCidr,
  srcRouteTableIds: vpcProdStack.prodRouteTableIds,
  dstVpcId: vpcMgmtStack.mgmtVpcId,
  dstVpcCidr: mgmtVpcCidr,
  dstRouteTableIds: vpcMgmtStack.mgmtRouteTableIds,
});

peeringStack.addDependency(vpcMgmtStack);
peeringStack.addDependency(vpcProdStack);


const applicatonStack = new NiscApplicationStack(app, 'nisc-application-stack', {
  prodVpc: vpcProdStack.prodVpc,
  prodVpcCidr: prodVpcCidr,
  mgmtVpc: vpcMgmtStack.mgmtVpc,
  mgmtVpcCidr: mgmtVpcCidr,
  pDBName: 'example',
  pDBUser: 'example',
  pDBPassword: 'pAssw0rd',
  pEC2KeyPair: 'devKey',
  pEnvironment: 'dev',
  pAppInstanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
  pAppAmi: '',
  pDBClass: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
  pDBAllocatedStorage: 25,
  pWebInstanceType: ec2.InstanceType.of(
    ec2.InstanceClass.T3,
    ec2.InstanceSize.MICRO
  ),
  pWebServerAMI: '',
});
