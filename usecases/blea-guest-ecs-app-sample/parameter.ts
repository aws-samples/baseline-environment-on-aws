import { Environment } from 'aws-cdk-lib';

// Parameters for Application
export interface AppParameter {
  env?: Environment;
  envName: string;
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;
  hostedZoneId: string;
  domainName: string;
  cloudFrontHostName: string;
  albHostName: string;
  dashboardName: string;
}

// Parameters for Pipelines
// You can use the same account or a different account than the application account.
// If you use independent account for pipeline, you have to bootstrap guest accounts with `--trust`.
// See: https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html
export interface PipelineParameter {
  env: Environment; // required
  sourceRepository: string;
  sourceBranch: string;
  sourceConnectionArn: string;
}

// Parameters for Dev Account
export const devParameter: AppParameter = {
  env: {
    // account: '111111111111',
    region: 'ap-northeast-1',
  },
  envName: 'Development',
  monitoringNotifyEmail: 'notify-security@example.com',
  monitoringSlackWorkspaceId: 'TXXXXXXXXXX',
  monitoringSlackChannelId: 'CYYYYYYYYYY',
  vpcCidr: '10.100.0.0/16',
  hostedZoneId: 'Z00000000000000000000',
  domainName: 'example.com',
  cloudFrontHostName: 'www',
  albHostName: 'alb',
  dashboardName: 'BLEA-ECS-App-Sample',
};

// Parameters for Pipeline Account
export const devPipelineParameter: PipelineParameter = {
  env: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
  sourceRepository: 'aws-samples/baseline-environment-on-aws',
  sourceBranch: 'main',
  sourceConnectionArn:
    'arn:aws:codestar-connections:us-west-2:222222222222:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};
