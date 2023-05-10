import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { devParameter } from '../parameter';
import { BLEAGovBaseCtScStack } from '../lib/stack/blea-gov-base-ct-via-service-catalog-stack';

test('Snapshot test for BLEGovABase Stack', () => {
  const app = new cdk.App();
  const stack = new BLEAGovBaseCtScStack(app, 'Dev-BLEAGovBaseCtSc', {
    env: devParameter.env,
    tags: {
      Repository: 'aws-samples/baseline-environment-on-aws',
      Environment: devParameter.envName,
    },

    securityNotifyEmail: devParameter.securityNotifyEmail,
  });

  // test with snapshot
  expect(Template.fromStack(stack)).toMatchSnapshot();
});
