import * as cdk from 'aws-cdk-lib';
import { BLEAEcsAppPipelineStack } from '../lib/stack/blea-guest-ecsapp-sample-via-cdk-pipelines-stack';

// Import parameters for each enviroment
import { devParameter, devPipelineParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAEcsAppPipelineStack(app, 'Dev-BLEAEcsAppPipeline', {
  targetParameters: [devParameter],
  env: devPipelineParameter.env,
  sourceRepository: devPipelineParameter.sourceRepository,
  sourceBranch: devPipelineParameter.sourceBranch,
  sourceConnectionArn: devPipelineParameter.sourceConnectionArn,
});
