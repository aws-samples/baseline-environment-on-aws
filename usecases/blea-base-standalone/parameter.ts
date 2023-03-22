import { Environment } from 'aws-cdk-lib';

export interface MyParameter {
  env?: Environment;
  envName: string;
  securityNotifyEmail: string;
}

// Example
export const DevParameter: MyParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};
