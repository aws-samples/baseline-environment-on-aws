import * as cdk from 'aws-cdk-lib';
import { BLEAGovBaseCtPipelineStack as BLEAGovBaseCtPipelineStack } from '../lib/stack/blea-gov-base-ct-via-cdk-pipelines-stack';

// Import parameters for each enviroment
import { devPipelineParameter, devParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBaseCtPipelineStack(app, 'Dev-BLEAGovBaseCtPipeilne', {
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devPipelineParameter.envName,
  },

  targetParameters: [devParameter],
  sourceRepository: devPipelineParameter.sourceRepository,
  sourceBranch: devPipelineParameter.sourceBranch,
  sourceConnectionArn: devPipelineParameter.sourceConnectionArn,
});
