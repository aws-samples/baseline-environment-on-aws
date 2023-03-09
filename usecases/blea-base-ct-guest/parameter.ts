import { Environment } from 'aws-cdk-lib';

export interface MyParameter {
  env?: Environment;
  envName: string;
  securityNotifyEmail: string;

  // (optional) AWS CodeStar Connections parameters for CDK Pipelines.
  // Only used in bin/blea-base-ct-guest-via-cdk-pipelines.ts
  sourceRepository?: string;
  sourceBranch?: string;
  sourceConnectionArn?: string;
}

// Example
export const DevParameter: MyParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  sourceRepository: 'aws-samples/baseline-environment-on-aws',
  sourceBranch: 'main',
  sourceConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/example',
};
