import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { devParameter, devPipelineParameter } from '../parameter';
import { Template } from 'aws-cdk-lib/assertions';
import { BLEAEcsAppPipelineStack } from '../lib/stack/blea-guest-ecs-app-sample-via-cdk-pipelines-stack';

test(`Snapshot test for BLEA ECS App Stacks`, () => {
  const app = new App();
  const pipeline = new BLEAEcsAppPipelineStack(app, 'Dev-BLEAEcsAppPipeline', {
    targetParameters: [devParameter],
    env: devPipelineParameter.env,
    sourceRepository: devPipelineParameter.sourceRepository,
    sourceBranch: devPipelineParameter.sourceBranch,
    sourceConnectionArn: devPipelineParameter.sourceConnectionArn,
  });

  expect(Template.fromStack(pipeline)).toMatchSnapshot();
});
