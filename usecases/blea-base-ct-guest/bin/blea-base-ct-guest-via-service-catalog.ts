import * as cdk from 'aws-cdk-lib';
import { BLEAGovBaseSCStack } from '../lib/stack/blea-base-ct-guest-via-service-catalog';

// Import parameters for each enviroment
import { devParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBaseSCStack(app, 'Dev-BLEAGovBase', {
  securityNotifyEmail: devParameter.securityNotifyEmail,
  tags: { Environment: devParameter.envName },
});
