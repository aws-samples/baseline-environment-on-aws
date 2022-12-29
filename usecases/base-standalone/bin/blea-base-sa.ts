import * as cdk from 'aws-cdk-lib';
import { BLEABaseSAStack } from '../lib/blea-base-sa-stack';

// Import parameters for each enviroment
import { DevParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEABaseSAStack(app, 'BLEABaseSA', {
  securityNotifyEmail: DevParameter.securityNotifyEmail,
  tags: { Environment: DevParameter.envName },
});
