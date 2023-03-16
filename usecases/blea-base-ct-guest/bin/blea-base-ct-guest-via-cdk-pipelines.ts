import * as cdk from 'aws-cdk-lib';
import { BLEABaseCTGuestPipelinesStack } from '../lib/stack/blea-base-ct-guest-via-cdk-pipelines-stack';

// Import parameters for each enviroment
import { DevParameter } from '../parameter';

const app = new cdk.App();

if (!DevParameter.sourceRepository || !DevParameter.sourceBranch || !DevParameter.sourceConnectionArn) {
  throw new Error("'sourceRepository', 'sourceBranch' and 'sourceConnectionArn' are required.");
}

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEABaseCTGuestPipelinesStack(app, 'DevBLEABaseCTGuestPipeilne', {
  securityNotifyEmail: DevParameter.securityNotifyEmail,
  sourceRepository: DevParameter.sourceRepository,
  sourceBranch: DevParameter.sourceBranch,
  sourceConnectionArn: DevParameter.sourceConnectionArn,
  tags: { Environment: DevParameter.envName },
});
