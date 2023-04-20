import { Environment } from 'aws-cdk-lib';

export interface AppParameter {
  env?: Environment;
  envName: string;
  securityNotifyEmail: string;
  securitySlackWorkspaceId?: string; // required if deploy via CLI
  securitySlackChannelId?: string; // required if deploy via CLI
}

export interface PipelineParameter {
  env: Environment;
  envName: string;

  // AWS CodeStar Connections parameters for CDK Pipelines.
  // Only used in bin/blea-gov-base-ct-via-cdk-pipelines.ts
  sourceRepository: string;
  sourceBranch: string;
  sourceConnectionArn: string;
}

// Example for Development
export const devParameter: AppParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  securitySlackWorkspaceId: 'T8XXXXXXX',
  securitySlackChannelId: 'C00XXXXXXXX',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};

// Example for Staging
export const stagingParameter: AppParameter = {
  envName: 'Staging',
  securityNotifyEmail: 'notify-security@example.com',
  env: { account: '123456789012', region: 'ap-northeast-1' },
};

// Example for Pipeline Deployment
export const devPipelineParameter: PipelineParameter = {
  env: { account: '123456789012', region: 'ap-northeast-1' },
  envName: 'DevPipeline',
  sourceRepository: 'aws-samples/baseline-environment-on-aws',
  sourceBranch: 'main',
  sourceConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/example',
};
