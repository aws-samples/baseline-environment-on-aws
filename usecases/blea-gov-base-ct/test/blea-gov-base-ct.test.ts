import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BLEAGovBaseCtStack } from '../lib/stack/blea-gov-base-ct-stack';
import { devParameter } from '../parameter';

test('Snapshot test for BLEGovABaseCt Stack', () => {
  const app = new cdk.App();
  const stack = new BLEAGovBaseCtStack(app, 'Dev-BLEAGovBaseCt', {
    env: devParameter.env,
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
