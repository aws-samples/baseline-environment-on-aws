import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as codebuild from '@aws-cdk/aws-codebuild';
import { LinuxBuildImage } from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';

export interface BLEAdeployStackProps extends cdk.StackProps {
  githubRepositoryOwner: string;
  githubRepositoryName: string;
  githubTargetBranch: string;
  codestarConnectionArn: string;
}

export class BLEAdeployStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: BLEAdeployStackProps) {
    super(scope, id, props);

    const pipeline = new codepipeline.Pipeline(this, `${id}-Pipeline`, {
      pipelineName: `${id}-Pipeline`,
    });

    // You just have to select GitHub as the source when creating the connection in the console
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: `${id}-GitHubSource`,
      owner: props.githubRepositoryOwner,
      repo: props.githubRepositoryName,
      branch: props.githubTargetBranch,
      connectionArn: props.codestarConnectionArn,
      output: sourceOutput,
    });

    const deployRole = new iam.Role(this, `${id}-CodeBuildDeployRole`, {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        {
          managedPolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
        },
      ],
    });

    const applicationBuild = new codebuild.PipelineProject(this, `${id}-CodeBuildProject`, {
      projectName: `${id}-CodeBuildProject`,
      role: deployRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
        environmentVariables: {
          AWS_DEFAULT_REGION: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: this.region,
          },
        },
      },
    });

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: `${id}-BuildAction`,
      project: applicationBuild,
      input: sourceOutput,
      runOrder: 3,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });
    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });
  }
}
