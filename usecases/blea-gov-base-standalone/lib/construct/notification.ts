import { Names } from 'aws-cdk-lib';
import { CfnSlackChannelConfiguration } from 'aws-cdk-lib/aws-chatbot';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface NotificationProps {
  topicArn: string;
  channelId: string;
  workspaceId: string;
}

export class Notification extends Construct {
  constructor(scope: Construct, id: string, props: NotificationProps) {
    super(scope, id);

    // AWS Chatbot configuration for sending message
    const chatbotRole = new Role(this, 'ChatbotRole', {
      assumedBy: new ServicePrincipal('chatbot.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess'),
      ],
    });

    // !!! Create SlackChannel and add aws chatbot app to the room
    new CfnSlackChannelConfiguration(this, 'ChatbotChannel', {
      configurationName: Names.uniqueResourceName(this, {}),
      slackChannelId: props.channelId,
      iamRoleArn: chatbotRole.roleArn,
      slackWorkspaceId: props.workspaceId,
      snsTopicArns: [props.topicArn],
    });
  }
}
