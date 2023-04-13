import * as cdk from 'aws-cdk-lib';
import { pipelines, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BLEAGovBaseStage } from '../stage/blea-base-ct-guest-stage';
import { AppParameter } from '../../parameter';

export interface BLEAGovBasePipelineStackProps extends cdk.StackProps {
  targetParameters: AppParameter[];
  sourceRepository: string;
  sourceBranch: string;
  sourceConnectionArn: string;
}

export class BLEAGovBasePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAGovBasePipelineStackProps) {
    super(scope, id, props);

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection(props.sourceRepository, props.sourceBranch, {
          connectionArn: props.sourceConnectionArn,
        }),
        installCommands: ['n stable', 'node --version', 'npm i -g npm', 'npm --version'],
        commands: [
          'npm ci --workspaces',
          'cd usecases/blea-base-ct-guest',
          'npx cdk synth --app "npx ts-node --prefer-ts-exts bin/blea-base-ct-guest-via-cdk-pipelines.ts" --all',
        ],
        primaryOutputDirectory: './usecases/blea-base-ct-guest/cdk.out',
      }),
    });

    props.targetParameters.forEach((params) => {
      pipeline.addStage(new BLEAGovBaseStage(this, 'Dev', params));
    });
  }
}
