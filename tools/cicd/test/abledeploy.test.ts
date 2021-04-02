import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AblEdeploy from '../lib/abledeploy-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AblEdeploy.ABLEdeployStack(app, 'MyTestStack', {
        githubRepositoryOwner: "githubRepositoryOwner",
        githubRepositoryName: "githubRepositoryName",
        githubTargetBranch: "githubTargetBranch"
      }
    );
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
