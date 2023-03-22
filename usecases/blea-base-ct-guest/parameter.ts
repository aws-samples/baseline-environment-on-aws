import { Environment } from 'aws-cdk-lib';

export interface BaselineParameter {
  env?: Environment;
  envName: string;
  securityNotifyEmail: string;

  // (optional) AWS CodeStar Connections parameters for CDK Pipelines.
  // Only used in bin/blea-base-ct-guest-via-cdk-pipelines.ts
  sourceRepository?: string;
  sourceBranch?: string;
  sourceConnectionArn?: string;
}

// Example for Development
export const DevParameter: BaselineParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};

// Example for Staging
export const StgParameter: BaselineParameter = {
  envName: 'Staging',
  securityNotifyEmail: 'notify-security@example.com',
  env: { account: '123456789012', region: 'ap-northeast-1' },
};

// Example for Pipeline Deployment
export const DevPipelineParameter: BaselineParameter = {
  envName: 'DevPipeline',
  securityNotifyEmail: 'notify-security@example.com',
  sourceRepository: 'ohmurayu/blea-pipeline',
  sourceBranch: 'main',
  sourceConnectionArn:
    'arn:aws:codestar-connections:ap-northeast-1:388375043318:connection/67dd8072-1cc7-45d2-aad8-46f6b81c6edd',
  //  sourceRepository: 'aws-samples/baseline-environment-on-aws',
  //  sourceBranch: 'main',
  //  sourceConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/example',
};
