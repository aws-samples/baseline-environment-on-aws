import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_codebuild as codebuild } from 'aws-cdk-lib';
import { aws_s3_assets as s3assets } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import * as path from 'path';

export interface BLEABuildContainerStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
}

export class BLEABuildContainerStack extends cdk.Stack {
  public readonly imageTag: string;

  constructor(scope: Construct, id: string, props: BLEABuildContainerStackProps) {
    super(scope, id, props);

    const appName = 'sample-ecs-app';

    this.imageTag = appName;

    // Upload Dockerfile and buildspec.yml to s3
    const asset = new s3assets.Asset(this, 'app-asset', {
      path: path.join(__dirname, '../container/sample-ecs-app'),
    });

    // CodeBuild project
    const project = new codebuild.Project(this, `${appName}-project`, {
      source: codebuild.Source.s3({
        bucket: asset.bucket,
        path: asset.s3ObjectKey,
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        privileged: true,
        environmentVariables: {
          AWS_DEFAULT_REGION: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${this.region}`,
          },
          AWS_ACCOUNT_ID: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${this.account}`,
          },
          IMAGE_TAG: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${appName}`,
          },
          IMAGE_REPO_NAME: {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.ecrRepository.repositoryName,
          },
        },
      },
    });
    project.addToRolePolicy(
      new iam.PolicyStatement({
        resources: ['*'],
        actions: ['ecr:GetAuthorizationToken'],
      }),
    );
    project.addToRolePolicy(
      new iam.PolicyStatement({
        resources: [`arn:aws:ecr:${this.region}:${this.account}:repository/${props.ecrRepository.repositoryName}`],
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:CompleteLayerUpload',
          'ecr:InitiateLayerUpload',
          'ecr:PutImage',
          'ecr:UploadLayerPart',
        ],
      }),
    );

    // CodeBuild:StartBuild
    const sdkcallForStartBuild = {
      service: 'CodeBuild',
      action: 'startBuild', // Must with a lowercase letter.
      parameters: {
        projectName: project.projectName,
      },
      physicalResourceId: cr.PhysicalResourceId.of(project.projectArn),
    };

    new cr.AwsCustomResource(this, 'startBuild', {
      policy: {
        statements: [
          new iam.PolicyStatement({
            resources: [project.projectArn],
            actions: ['codebuild:StartBuild'],
          }),
        ],
      },
      onCreate: sdkcallForStartBuild,
    });
  }
}
