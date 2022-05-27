import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { pipelines } from 'aws-cdk-lib';

export interface BLEAPipelineStackProps extends cdk.StackProps {
  repository: string;
  branch: string;
  connectionArn: string;
  environment?: string;
  deployStage: cdk.Stage;
}

export class BLEAPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BLEAPipelineStackProps) {
    super(scope, id, props);
    let environment = 'dev';

    if (props.environment) {
      environment = props.environment;
    }

    const deployRole = new iam.Role(this, `${id}-CodeBuildDeployRole`, {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        {
          managedPolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
        },
      ],
    });

    // You just have to select GitHub as the source when creating the connection in the console
    // basic pipeline declaration. This sets the initial structure of our pipeline
    const pipeline = new pipelines.CodePipeline(this, `${id}-pipeline`, {
      // crossAccountKeys: true,
      synth: new pipelines.CodeBuildStep('SynthStep', {
        input: pipelines.CodePipelineSource.connection(props.repository, props.branch, {
          connectionArn: props.connectionArn,
        }),

        installCommands: ['n stable', 'node -v', 'npm update npm'],
        commands: [
          'echo "node: $(node --version)" ',
          'echo "npm: $(npm --version)" ',
          'npm ci',
          'npm audit',
          'npm run lint',
          'cd usecases/guest-webapp-sample',
          'npm run build',
          'npm run test',
          `npx cdk synth --app "npx ts-node --prefer-ts-exts bin/blea-guest-ecsapp-sample-pipeline.ts" -c environment=${environment}`,
          `npx cdk ls -c environment=${environment}`,
        ],
        role: deployRole,
        primaryOutputDirectory: './usecases/guest-webapp-sample/cdk.out',
      }),
    });
    pipeline.addStage(props.deployStage);
  }
}
