import * as cdk from 'aws-cdk-lib';
import { BLEAGovBaseStandaloneStack } from '../lib/stack/blea-gov-base-standalone-stack';

// Import parameters for each enviroment
import { devParameter } from '../parameter';

const app = new cdk.App();

if (!devParameter.securitySlackWorkspaceId || !devParameter.securitySlackChannelId) {
  throw new Error('securitySlackWorkspaceId and securitySlackChannelId are required');
}

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBaseStandaloneStack(app, 'Dev-BLEAGovBaseStandalone', {
  env: devParameter.env,
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  securityNotifyEmail: devParameter.securityNotifyEmail,
  securitySlackWorkspaceId: devParameter.securitySlackWorkspaceId,
  securitySlackChannelId: devParameter.securitySlackChannelId,
});
