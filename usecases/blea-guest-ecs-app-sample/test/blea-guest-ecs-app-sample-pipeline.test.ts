import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { devParameter, devPipelineParameter } from '../parameter';
import { Template } from 'aws-cdk-lib/assertions';
import { BLEAEcsAppPipelineStack } from '../lib/stack/blea-guest-ecs-app-sample-via-cdk-pipelines-stack';

test(`Snapshot test for BLEA ECS App Stacks`, () => {
  const app = new App();
  const pipeline = new BLEAEcsAppPipelineStack(app, 'Dev-BLEAEcsAppPipeline', {
    // Account and Region on test
    //  cdk.process.env.* returns undefined, and cdk.Stack.of(this).* returns ${Token[Region.4]} at test time.
    //  In such case, RegionInfo.get(cdk.Stack.of(this).region) returns error and test will fail.
    //  So we pass 'ap-northeast-1' as region code.
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
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

  expect(Template.fromStack(pipeline)).toMatchSnapshot();
});
