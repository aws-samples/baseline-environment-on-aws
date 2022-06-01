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
  envName: 'Home',
  securityNotifyEmail: 'gen@gensobunya.net',
  securitySlackWorkspaceId: 'T02LM8Q55CK',
  securitySlackChannelId: 'C02MAULEV7A',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};
