import { expect as expectCDK, matchTemplate, MatchStyle, SynthUtils } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as NiscVpcProduction from '../lib/nisc-vpc-production-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new NiscVpcProduction.NiscVpcProductionStack(app, 'MyTestStack', {
      prodVpcCidr: '10.100.0.0/16'
    });
    // THEN
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
