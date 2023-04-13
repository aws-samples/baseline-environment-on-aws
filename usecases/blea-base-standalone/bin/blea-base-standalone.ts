import * as cdk from 'aws-cdk-lib';
import { BLEAGovBaseStack } from '../lib/stack/blea-base-standalone-stack';

// Import parameters for each enviroment
import { devParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBaseStack(app, 'Dev-BLEAGovBase', {
  securityNotifyEmail: devParameter.securityNotifyEmail,
  tags: { Environment: devParameter.envName },
});
