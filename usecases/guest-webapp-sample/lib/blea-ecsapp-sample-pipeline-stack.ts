import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_codebuild as codebuild } from 'aws-cdk-lib';
import { pipelines } from 'aws-cdk-lib';

export interface BLEAPipelineStackProps extends cdk.StackProps {
  // githubRepositoryOwner: string;
  // githubRepositoryName: string;
  githubRepository: string;
  githubTargetBranch: string;
  codestarConnectionArn: string;

  deployStage: cdk.Stage;
}

export class BLEAPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BLEAPipelineStackProps) {
    super(scope, id, props);

    // 'Owner/Repo'で渡すので、二つの引数をまとめて一つのPropにする。
    // const githubRepository = props.githubRepositoryOwner + '/' + props.githubRepositoryName;
    const githubRepository = props.githubRepository;

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
    const pipeline = new pipelines.CodePipeline(this, 'pipeline', {
      selfMutation: false,
      pipelineName: 'EcsSamplePipeline',
      // ここをShellStageにするのか、CodeBuildStageにするのかは、コマンドをCodeBuildで走らせたいかに依存する。
      synth: new pipelines.CodeBuildStep('SynthStep', {
        // input: このパイプラインでビルドするべきソースコード（つまり、BLEAのProjectコード）
        input: pipelines.CodePipelineSource.connection(githubRepository, props.githubTargetBranch, {
          connectionArn: props.codestarConnectionArn,
        }),
        installCommands: ['n stable', 'node -v', 'npm i -g npm@8.3'],
        commands: [
          'echo "node: $(node --version)" ',
          'echo "npm: $(npm --version)" ',
          'npm ci',
          'npm audit',
          'npm run lint',
          'cd usecases/guest-webapp-sample',
          'npm run build',
          'npm run test',
          'npm run synth:dev',
          // # You can specify CDK deployment commands.
          // # Usually, you may want to deploy all of resources in the app.
          // # If you want to do so, please specify `"*"`
          // ' npx cdk deploy BLEA-MonitorAlarm -c environment=dev --require-approval never',
        ],
        role: deployRole,
        // control Build Environment
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
          environmentVariables: {
            AWS_DEFAULT_REGION: {
              type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
              value: this.region,
            },
          },
        },
        primaryOutputDirectory: './usecases/guest-webapp-sample/cdk.out',
      }),
    });
    pipeline.addStage(props.deployStage);
  }
}
