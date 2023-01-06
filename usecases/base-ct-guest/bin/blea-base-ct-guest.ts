import * as cdk from 'aws-cdk-lib';
import { BLEABaseCTGuestStack } from '../lib/stack/blea-base-ct-guest-stack';

// Import parameters for each enviroment
import { DevParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEABaseCTGuestStack(app, 'DevBLEABaseCTGuest', {
  securityNotifyEmail: DevParameter.securityNotifyEmail,
  tags: { Environment: DevParameter.envName },
});
