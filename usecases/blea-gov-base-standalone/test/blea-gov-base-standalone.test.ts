import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BLEAGovBaseStandaloneStack } from '../lib/stack/blea-gov-base-standalone-stack';
import { devParameter } from '../parameter';

test('Snapshot test for BLEAGovBaseStandalone Stack', () => {
  const app = new cdk.App();
  const stack = new BLEAGovBaseStandaloneStack(app, 'Dev-BLEABaseStandalone', {
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
