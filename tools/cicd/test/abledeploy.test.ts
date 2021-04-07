import { SynthUtils } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AblEdeploy from '../lib/abledeploy-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const pjPrefix = 'ABLE';
const app = new cdk.App();
const envKey = 'dev';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Stacks`, () => {
  test('Empty Stack', () => {
    const deployStack = new AblEdeploy.ABLEdeployStack(app, 'DeployStack', {
      githubRepositoryOwner: 'githubRepositoryOwner',
      githubRepositoryName: 'githubRepositoryName',
      githubTargetBranch: 'githubTargetBranch',
      env: procEnv,
    });

    // test with snapshot
    expect(SynthUtils.toCloudFormation(deployStack)).toMatchSnapshot();
  });
});
