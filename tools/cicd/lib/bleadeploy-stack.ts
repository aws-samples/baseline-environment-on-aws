import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_codebuild as codebuild } from 'aws-cdk-lib';
import { aws_codepipeline as codepipeline } from 'aws-cdk-lib';
import { aws_codepipeline_actions as codepipeline_actions } from 'aws-cdk-lib';

export interface BLEAdeployStackProps extends cdk.StackProps {
  githubRepositoryOwner: string;
  githubRepositoryName: string;
  githubTargetBranch: string;
  codestarConnectionArn: string;
}

export class BLEAdeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BLEAdeployStackProps) {
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
