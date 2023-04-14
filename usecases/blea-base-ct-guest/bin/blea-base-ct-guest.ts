import * as cdk from 'aws-cdk-lib';
import { BLEAGovBaseCtStack as BLEAGovBaseCtStack } from '../lib/stack/blea-base-ct-guest-stack';

// Import parameters for each enviroment
import { devParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBaseCtStack(app, 'Dev-BLEAGovBaseCt', {
  securityNotifyEmail: devParameter.securityNotifyEmail,
  tags: { Environment: devParameter.envName },
});
