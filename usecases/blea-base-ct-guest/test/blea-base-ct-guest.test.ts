import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { BLEABaseCTGuestStack } from '../lib/stack/blea-base-ct-guest-stack';
import { DevParameter } from '../parameter';

const app = new cdk.App();

describe(`BLEABaseCTGuest App`, () => {
  test('Snapshot test for BLEABaseCTGuest Stack', () => {
    const bleaBaseCTGuestStack = new BLEABaseCTGuestStack(app, 'DevBLEABaseCTGuest', {
      securityNotifyEmail: DevParameter.securityNotifyEmail,
      tags: { Environment: DevParameter.envName },
    });

    // test with snapshot
    expect(Template.fromStack(bleaBaseCTGuestStack)).toMatchSnapshot();
  });
});
