import { SynthUtils } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as BLEAdeploy from '../lib/bleadeploy-stack';

// Load cdk.json to get context parameters
import * as cdk_json from '../cdk.json';

const pjPrefix = 'BLEA';
const app = new cdk.App();
const envKey = 'stagepipeline';
const envVals = cdk_json['context'][envKey];

describe(`${pjPrefix} Stacks`, () => {
  test('BLEA Deploy Stack', () => {
    const deployStack = new BLEAdeploy.BLEAdeployStack(app, 'DeployStack', {
      githubRepositoryOwner: envVals['githubRepositoryOwner'],
      githubRepositoryName: envVals['githubRepositoryName'],
      githubTargetBranch: envVals['githubTargetBranch'],
      codestarConnectionArn: envVals['codestarConnectionArn'],
      env: envVals['env'],
    });

    // test with snapshot
    expect(SynthUtils.toCloudFormation(deployStack)).toMatchSnapshot();
  });
});
