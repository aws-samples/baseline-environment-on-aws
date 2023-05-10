import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BLEAGovBaseStandaloneStack } from '../lib/stack/blea-gov-base-standalone-stack';
import { devParameter } from '../parameter';

test('Snapshot test for BLEAGovBaseStandalone Stack', () => {
  const app = new cdk.App();
  const stack = new BLEAGovBaseStandaloneStack(app, 'Dev-BLEABaseStandalone', {
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
      Environment: devParameter.envName,
    },

    securityNotifyEmail: devParameter.securityNotifyEmail,
    securitySlackWorkspaceId: devParameter.securitySlackWorkspaceId,
    securitySlackChannelId: devParameter.securitySlackChannelId,
  });

  // test with snapshot
  expect(Template.fromStack(stack)).toMatchSnapshot();
});
