import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BLEAEc2AppStack } from '../lib/stack/blea-guest-ec2-app-sample-stack';
import { devParameter } from '../parameter';
const app = new cdk.App();

new BLEAEc2AppStack(app, 'Dev-BLEAEc2App', {
  monitoringNotifyEmail: devParameter.monitoringNotifyEmail,
  monitoringSlackWorkspaceId: devParameter.monitoringSlackWorkspaceId,
  monitoringSlackChannelId: devParameter.monitoringSlackChannelId,
  vpcCidr: devParameter.vpcCidr,

  // props for cdk.Stack
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
