import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_chatbot as cb } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';

export interface BLEAChatbotStackProps extends cdk.StackProps {
  topicArn: string;
  channelId: string;
  workspaceId: string;
}

// NOTICE: AWS Chatbot can send events from supported services only.
// See: https://docs.aws.amazon.com/ja_jp/chatbot/latest/adminguide/related-services.html
export class BLEAChatbotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BLEAChatbotStackProps) {
    super(scope, id, props);

    // !!! Create SlackChannel and add aws chatbot app to the room
    const slackChatbotChannel = new cb.SlackChannelConfiguration(this, 'ChatbotChannel', {
      slackChannelConfigurationName: `${id}-${props.workspaceId}`,
      slackChannelId: props.channelId,
      slackWorkspaceId: props.workspaceId,
    });

    // AWS Chatbot configuration for sending message
    slackChatbotChannel.addNotificationTopic(sns.Topic.fromTopicArn(this, 'ChatbotTopic', props.topicArn));
    slackChatbotChannel.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
  }
}
