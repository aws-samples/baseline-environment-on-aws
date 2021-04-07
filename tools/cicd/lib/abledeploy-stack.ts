import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as codebuild from "@aws-cdk/aws-codebuild";

export interface ABLEdeployStackProps extends cdk.StackProps {
  githubRepositoryOwner: string;
  githubRepositoryName: string;
  githubTargetBranch: string;
}

export class ABLEdeployStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ABLEdeployStackProps) {
    super(scope, id, props);

    // Create GitHub source for CodeBuild
    const gitHubSource = codebuild.Source.gitHub({
      owner: props.githubRepositoryOwner,
      repo: props.githubRepositoryName,
      webhook: true,
      fetchSubmodules: true,
      webhookFilters: [
        codebuild.FilterGroup.inEventOf(codebuild.EventAction.PUSH).andBranchIs(
          props.githubTargetBranch
        ),
      ],
    });

    // Create CodeBuild from GitHub source
    const project = new codebuild.Project(this, "ABLEdeployProject", {
      source: gitHubSource,
    });

    // Change role for CodeBuild to attache Admin access for using CDK
    const role = project.role;
    if (role) {
      role.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
      );
    }
  }
}
