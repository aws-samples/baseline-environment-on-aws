import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { BLEAEc2AppSampleStack } from '../lib/stack/blea-guest-ec2app-sample-stack';
import { devParameter } from '../parameter';
const app = new cdk.App();

describe('BLEAEc2AppSample App', () => {
  test('Snapshot test for BLEAEc2AppSample Stack', () => {
    const stack = new BLEAEc2AppSampleStack(app, 'BLEAEc2AppSampleDev', {
      monitoringNotifyEmail: devParameter.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: devParameter.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: devParameter.monitoringSlackChannelId,
      vpcCidr: devParameter.vpcCidr,
      tags: {
        Repository: 'aws-samples/baseline-environment-on-aws',
        Environment: devParameter.envName,
      },
      // Account and Region on test
      //  cdk.process.env.* returns undefined, and cdk.Stack.of(this).* returns ${Token[Region.4]} at test time.
      //  In such case, RegionInfo.get(cdk.Stack.of(this).region) returns error and test will fail.
      //  So we pass 'ap-northeast-1' as region code.
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
      },
    });
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });
});
