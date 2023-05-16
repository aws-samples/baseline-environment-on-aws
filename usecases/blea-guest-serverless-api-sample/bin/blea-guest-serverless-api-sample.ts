import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BLEAServerlessApiStack } from '../lib/stack/blea-guest-serverless-api-sample-stack';
import { devParameter } from '../parameter';
const app = new cdk.App();

new BLEAServerlessApiStack(app, 'Dev-BLEAServerlessApi', {
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  monitoringNotifyEmail: devParameter.monitoringNotifyEmail,
  monitoringSlackWorkspaceId: devParameter.monitoringSlackWorkspaceId,
  monitoringSlackChannelId: devParameter.monitoringSlackChannelId,
});
