import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as iam from '@aws-cdk/aws-iam';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as s3assets from '@aws-cdk/aws-s3-assets';

import * as path from 'path';

export interface ABLEBuildContainerStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository
}

export class ABLEBuildContainerStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ABLEBuildContainerStackProps) {
    super(scope, id, props);

    const asset = new s3assets.Asset(this, 'SampleAsset', {
      path: path.join(__dirname, '../assets/sample-app'),
    });

    const project = new codebuild.Project(this, 'sample-app', {
      source: codebuild.Source.s3({
        bucket: asset.bucket,
        path: asset.s3ObjectKey
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
            value: 'latest',
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
      //resources: [`arn:aws:ecr:${this.region}:${this.account}:repository/${props.ecrRepository.repositoryName}`],
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:CompleteLayerUpload',
        'ecr:GetAuthorizationToken',
        'ecr:InitiateLayerUpload',
        'ecr:PutImage',
        'ecr:UploadLayerPart'
      ]
    }));

  }
}
