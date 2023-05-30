import { Environment } from 'aws-cdk-lib';

export interface AppParameter {
  env?: Environment;
  envName: string;
  securityNotifyEmail: string;
  securitySlackWorkspaceId: string; // required if deploy via CLI
  securitySlackChannelId: string; // required if deploy via CLI
}

// Example
export const devParameter: AppParameter = {
  envName: 'Development',
  securityNotifyEmail: 'suzukyz+notify-security@amazon.co.jp',
  securitySlackWorkspaceId: 'T030VKQD7BM',
  securitySlackChannelId: 'C031889HJRF',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};
