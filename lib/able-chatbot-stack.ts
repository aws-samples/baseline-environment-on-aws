import * as cdk from '@aws-cdk/core';
import * as sns from '@aws-cdk/aws-sns';
import * as cb from '@aws-cdk/aws-chatbot';
import * as iam from '@aws-cdk/aws-iam';

export interface ABLEChatbotStackProps extends cdk.StackProps {
  topic: sns.Topic,
  channelId: string,
  workspaceId: string,
}

export class ABLEChatbotStack extends cdk.Stack {
  
  constructor(scope: cdk.Construct, id: string, props: ABLEChatbotStackProps) {
    super(scope, id, props);

    // AWS Chatbot configuration for sending message
    const chatbotRole = new iam.Role(this, 'ChatbotRole', {
      assumedBy:new iam.ServicePrincipal('chatbot.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess'),
      ]
    });

    // !!! Create SlackChannel and add aws chatbot app to the room
    const chatbot = new cb.CfnSlackChannelConfiguration(this, 'ChatbotChannel', {
      configurationName: 'ChatbotChannel',
      slackChannelId: props.channelId,
      iamRoleArn: chatbotRole.roleArn,
      slackWorkspaceId: props.workspaceId,
      snsTopicArns: [
        props.topic.topicArn
      ]
    });
 
  }
}
