import { Environment } from 'aws-cdk-lib';

// Parameters for Application
export interface AppParameter {
  env?: Environment;
  envName: string;
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;
  dashboardName: string;

  // -- Sample to use custom domain on CloudFront
  // hostedZoneId: string;
  // domainName: string;
  // cloudFrontHostName: string;
}

// Parameters for Pipelines
// You can use the same account or a different account than the application account.
// If you use independent account for pipeline, you have to bootstrap guest accounts with `--trust`.
// See: https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html
export interface PipelineParameter {
  env: Environment; // required
  envName: string;
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
  dashboardName: 'BLEA-ECS-App-Sample',

  // -- Sample to use custom domain on CloudFront
  // hostedZoneId: 'Z00000000000000000000',
  // domainName: 'example.com',
  // cloudFrontHostName: 'www',
};

// Parameters for Pipeline Account
export const devPipelineParameter: PipelineParameter = {
  env: {
    account: '123456789012',
    region: 'ap-northeast-1',
  },
  envName: 'DevPipeline',
  sourceRepository: 'aws-samples/baseline-environment-on-aws',
  sourceBranch: 'main',
  sourceConnectionArn:
    'arn:aws:codestar-connections:us-west-2:222222222222:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};
