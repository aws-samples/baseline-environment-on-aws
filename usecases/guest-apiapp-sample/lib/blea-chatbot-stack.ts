import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_chatbot as cb } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

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

    // AWS Chatbot configuration for sending message
    const chatbotRole = new iam.Role(this, 'ChatbotRole', {
      assumedBy: new iam.ServicePrincipal('chatbot.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess'),
      ],
    });

    // !!! Create SlackChannel and add aws chatbot app to the room
    new cb.CfnSlackChannelConfiguration(this, 'ChatbotChannel', {
      configurationName: `${id}-${props.workspaceId}`,
      slackChannelId: props.channelId,
      iamRoleArn: chatbotRole.roleArn,
      slackWorkspaceId: props.workspaceId,
      snsTopicArns: [props.topicArn],
    });
  }
}
