import * as cdk from 'aws-cdk-lib';
import { BLEAGovBaseCtScStack as BLEAGovBaseCtScStack } from '../lib/stack/blea-gov-base-ct-via-service-catalog';

// Import parameters for each enviroment
import { devParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBaseCtScStack(app, 'Dev-BLEAGovBaseCtSc', {
  securityNotifyEmail: devParameter.securityNotifyEmail,
  tags: { Environment: devParameter.envName },
});
