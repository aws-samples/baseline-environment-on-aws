import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { BLEAGovBaseStack } from '../lib/stack/blea-base-standalone-stack';
import { devParameter } from '../parameter';

const app = new cdk.App();

describe(`BLEAGovBase App`, () => {
  test('Snapshot test for BLEAGovBase Stack', () => {
    const bleaGovBaseStack = new BLEAGovBaseStack(app, 'Dev-BLEABaseStandalone', {
      securityNotifyEmail: devParameter.securityNotifyEmail,
      tags: { Environment: devParameter.envName },
    });

    // test with snapshot
    expect(Template.fromStack(bleaGovBaseStack)).toMatchSnapshot();
  });
});
