import * as cdk from 'aws-cdk-lib';
import { BLEAGovBasePipelineStack } from '../lib/stack/blea-base-ct-guest-via-cdk-pipelines-stack';

// Import parameters for each enviroment
import { devPipelineParameter, devParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBasePipelineStack(app, 'Dev-BLEAGovBasePipeilne', {
  targetParameters: [devParameter],
  sourceRepository: devPipelineParameter.sourceRepository,
  sourceBranch: devPipelineParameter.sourceBranch,
  sourceConnectionArn: devPipelineParameter.sourceConnectionArn,
});
