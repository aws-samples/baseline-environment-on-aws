import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { BLEABaseStandaloneStack } from '../lib/stack/blea-base-standalone-stack';
import { DevParameter } from '../parameter';

const app = new cdk.App();

describe(`BLEABaseStandalone App`, () => {
  test('Snapshot test for BLEABaseStandalone Stack', () => {
    const bleaBaseStandaloneStack = new BLEABaseStandaloneStack(app, 'DevBLEABaseStandalone', {
      securityNotifyEmail: DevParameter.securityNotifyEmail,
      tags: { Environment: DevParameter.envName },
    });

    // test with snapshot
    expect(Template.fromStack(bleaBaseStandaloneStack)).toMatchSnapshot();
  });
});
