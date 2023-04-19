import * as cdk from 'aws-cdk-lib';
import { BLEAGovBaseCtStack as BLEAGovBaseCtStack } from '../lib/stack/blea-gov-base-ct-stack';

// Import parameters for each enviroment
import { devParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBaseCtStack(app, 'Dev-BLEAGovBaseCt', {
  env: devParameter.env,
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  securityNotifyEmail: devParameter.securityNotifyEmail,
  securitySlackWorkspaceId: devParameter.securitySlackWorkspaceId,
  securitySlackChannelId: devParameter.securitySlackChannelId,
});
