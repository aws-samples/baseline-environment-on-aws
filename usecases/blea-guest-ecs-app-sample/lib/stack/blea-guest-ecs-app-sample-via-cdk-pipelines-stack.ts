import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam, Environment } from 'aws-cdk-lib';
import { pipelines } from 'aws-cdk-lib';
import { BLEAEcsAppStage } from '../stage/blea-guest-ecs-app-sample-stage';
import { AppParameter } from '../../parameter';

export interface BLEAEcsAppPipelineStackProps extends cdk.StackProps {
  targetParameters: AppParameter[];
  env: Environment;
  sourceRepository: string;
  sourceBranch: string;
  sourceConnectionArn: string;
}

export class BLEAEcsAppPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BLEAEcsAppPipelineStackProps) {
    super(scope, id, props);

    const deployRole = new iam.Role(this, 'CodeBuildDeployRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        {
          managedPolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
        },
      ],
    });

    // You just have to select GitHub as the source when creating the connection in the console
    // basic pipeline declaration. This sets the initial structure of our pipeline
    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true,
      synth: new pipelines.CodeBuildStep('SynthStep', {
        input: pipelines.CodePipelineSource.connection(props.sourceRepository, props.sourceBranch, {
          connectionArn: props.sourceConnectionArn,
        }),
        installCommands: ['n stable', 'node --version', 'npm i -g npm', 'npm --version'],
        commands: [
          'npm ci --workspaces',
          'cd usecases/blea-guest-ecs-app-sample',
          'npx cdk synth --app "npx ts-node --prefer-ts-exts bin/blea-guest-ecs-app-sample-via-cdk-pipelines.ts"',
        ],
        role: deployRole,
        primaryOutputDirectory: './usecases/blea-guest-ecs-app-sample/cdk.out',
      }),
    });

    props.targetParameters.forEach((params) => {
      pipeline.addStage(new BLEAEcsAppStage(this, 'Dev', params));
    });
  }
}
