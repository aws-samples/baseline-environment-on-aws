import * as cdk from 'aws-cdk-lib';
import { BLEABaseCTGuestSCStack } from '../lib/stack/blea-base-ct-guest-via-service-catalog';

// Import parameters for each enviroment
import { DevParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEABaseCTGuestSCStack(app, 'DevBLEABaseCTGuest', {
  securityNotifyEmail: DevParameter.securityNotifyEmail,
  tags: { Environment: DevParameter.envName },
});
