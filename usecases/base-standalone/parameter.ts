import { Environment } from 'aws-cdk-lib';

export interface MyParameter {
  env?: Environment;
  envName: string;
  securityNotifyEmail: string;
  chatbotSlackWorkspaceId: string;
  chatbotSlackChannelId: string;
}

// Example
export const DevParameter: MyParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  chatbotSlackWorkspaceId: 'T8XXXXXXX',
  chatbotSlackChannelId: 'C00XXXXXXXX',
};
