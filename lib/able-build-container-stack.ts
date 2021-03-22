import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as s3assets from '@aws-cdk/aws-s3-assets';
import * as cr from '@aws-cdk/custom-resources';

import * as path from 'path';

export interface ABLEBuildContainerStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository
}

export class ABLEBuildContainerStack extends cdk.Stack {
  public readonly imageTag: string; 

  constructor(scope: cdk.Construct, id: string, props: ABLEBuildContainerStackProps) {
    super(scope, id, props);

    const unixtime = Math.floor(Date.now() / 1000);

    const appName ='sample-app';

    this.imageTag = appName;

    // Upload Dockerfile and buildspec.yml to s3
    const asset = new s3assets.Asset(this, 'app-asset', {
      path: path.join(__dirname, '../assets/sample-app')
    });

    // CodeBuild project
    //const project = new codebuild.Project(this, `${appName}-project-${unixtime}`, {
    const project = new codebuild.Project(this, `${appName}-project`, {
      source: codebuild.Source.s3({
        bucket: asset.bucket,
        path: asset.s3ObjectKey,
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
        privileged: true,
        environmentVariables: {
          'AWS_DEFAULT_REGION': {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${this.region}`
          },
          'AWS_ACCOUNT_ID': {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${this.account}`
          },
          'IMAGE_TAG': {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: `${appName}`,
          },
          'IMAGE_REPO_NAME': {
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: props.ecrRepository.repositoryName
          }
        }
      }
    });
    project.addToRolePolicy(new iam.PolicyStatement({
      resources: [ '*' ],
      actions: [
        'ecr:GetAuthorizationToken',
      ]
    }));
    project.addToRolePolicy(new iam.PolicyStatement({
      resources: [`arn:aws:ecr:${this.region}:${this.account}:repository/${props.ecrRepository.repositoryName}`],
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:CompleteLayerUpload',
        'ecr:InitiateLayerUpload',
        'ecr:PutImage',
        'ecr:UploadLayerPart'
      ]
    }));


    // CodeBuild:StartBuild
    const sdkcallForStartBuild = {
        service: 'CodeBuild',
        action: 'startBuild', // Must with a lowercase letter.
        parameters: {
          projectName: project.projectName
        },
        physicalResourceId: cr.PhysicalResourceId.of(project.projectArn)
    }

    const startBuild = new cr.AwsCustomResource(this, 'startBuild', {
      policy: {
        statements: [
          new iam.PolicyStatement({
            resources: [ '*' ],
            actions: [
              'codebuild:StartBuild'
            ]
          }),
        ]
      },
      onCreate: sdkcallForStartBuild,
//      onUpdate: sdkcallForStartBuild
    });

  }
}
