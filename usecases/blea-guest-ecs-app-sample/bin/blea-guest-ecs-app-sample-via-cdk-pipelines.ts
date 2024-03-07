import * as cdk from 'aws-cdk-lib';
import { BLEAEcsAppPipelineStack } from '../lib/stack/blea-guest-ecs-app-sample-via-cdk-pipelines-stack';

// Import parameters for each enviroment
import { devParameter, devPipelineParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAEcsAppPipelineStack(app, 'Dev-BLEAEcsAppPipeline', {
  description:
    'Pipeline stack for BLEA ECS App sample for guest accounts (uksb-1tupboc58) (tag:blea-guest-ecs-app-sample-via-cdk-pipelines)',
  env: {
    account: devPipelineParameter.env.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devPipelineParameter.env.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },
  targetParameters: [devParameter],
  sourceRepository: devPipelineParameter.sourceRepository,
  sourceBranch: devPipelineParameter.sourceBranch,
  sourceConnectionArn: devPipelineParameter.sourceConnectionArn,
});
