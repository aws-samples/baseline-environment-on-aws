import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { BLEAGovBaseStack } from '../lib/stack/blea-base-ct-guest-stack';
import { devParameter } from '../parameter';

const app = new cdk.App();

describe(`BLEGovABase App`, () => {
  test('Snapshot test for BLEGovABase Stack', () => {
    const bleaGovBaseStack = new BLEAGovBaseStack(app, 'Dev-BLEAGovBase', {
      securityNotifyEmail: devParameter.securityNotifyEmail,
      tags: { Environment: devParameter.envName },
    });

    // test with snapshot
    expect(Template.fromStack(bleaGovBaseStack)).toMatchSnapshot();
  });
});
