import { Environment } from 'aws-cdk-lib';

// Parameters for Application
export interface AppParameter {
  env?: Environment;
  envName: string;
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
}

// Example
export const devParameter: AppParameter = {
  envName: 'Development',
  monitoringNotifyEmail: 'notify-security@example.com',
  monitoringSlackWorkspaceId: 'TXXXXXXXXXX',
  monitoringSlackChannelId: 'CYYYYYYYYYY',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};
