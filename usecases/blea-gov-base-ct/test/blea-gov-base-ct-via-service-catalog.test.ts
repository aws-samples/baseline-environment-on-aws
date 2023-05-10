import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { devParameter } from '../parameter';
import { BLEAGovBaseCtScStack } from '../lib/stack/blea-gov-base-ct-via-service-catalog-stack';

test('Snapshot test for BLEGovABase Stack', () => {
  const app = new cdk.App();
  const stack = new BLEAGovBaseCtScStack(app, 'Dev-BLEAGovBaseCtSc', {
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
  });

  // test with snapshot
  expect(Template.fromStack(stack)).toMatchSnapshot();
});
