import * as cdk from 'aws-cdk-lib';
import { pipelines, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BLEAGovBaseCtStage } from '../stage/blea-gov-base-ct-stage';
import { AppParameter } from '../../parameter';

export interface BLEAGovBaseCtPipelineStackProps extends cdk.StackProps {
  targetParameters: AppParameter[];
  sourceRepository: string;
  sourceBranch: string;
  sourceConnectionArn: string;
}

export class BLEAGovBaseCtPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAGovBaseCtPipelineStackProps) {
    super(scope, id, props);

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection(props.sourceRepository, props.sourceBranch, {
          connectionArn: props.sourceConnectionArn,
        }),
        installCommands: ['n stable', 'node --version', 'npm i -g npm', 'npm --version'],
        commands: [
          'npm ci --workspaces',
          'cd usecases/blea-gov-base-ct',
          'npx cdk synth --app "npx ts-node --prefer-ts-exts bin/blea-gov-base-ct-via-cdk-pipelines.ts" --all',
        ],
        primaryOutputDirectory: './usecases/blea-gov-base-ct/cdk.out',
      }),
    });

    props.targetParameters.forEach((params) => {
      pipeline.addStage(new BLEAGovBaseCtStage(this, 'Dev', params));
    });
  }
}
