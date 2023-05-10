import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { devParameter, devPipelineParameter } from '../parameter';
import { BLEAGovBaseCtPipelineStack } from '../lib/stack/blea-gov-base-ct-via-cdk-pipelines-stack';

test('Snapshot test for BLEAGovABaseCtPipeline Stack', () => {
  const app = new cdk.App();
  const stack = new BLEAGovBaseCtPipelineStack(app, 'Dev-BLEAGovBaseCtPipeilne', {
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

  // test with snapshot
  expect(Template.fromStack(stack)).toMatchSnapshot();
});
