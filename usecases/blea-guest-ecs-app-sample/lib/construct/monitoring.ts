import { aws_chatbot as cb, aws_iam as iam, aws_sns as sns, Names, PhysicalName } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface MonitoringProps {
  monitoringNotifyEmail: string;
  monitoringSlackChannelId: string;
  monitoringSlackWorkspaceId: string;
}

export class Monitoring extends Construct {
  public readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    // SNS Topic for Monitoring Alarm
    const topic = new sns.Topic(this, 'AlarmTopic', {
      topicName: PhysicalName.GENERATE_IF_NEEDED, // for crossRegionReference
    });

    new sns.Subscription(this, 'EmailSubsc', {
      endpoint: props.monitoringNotifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: topic,
    });
    this.alarmTopic = topic;

    // Allow to publish message from CloudWatch
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );

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
      configurationName: Names.uniqueResourceName(this, {}),
      slackChannelId: props.monitoringSlackChannelId,
      iamRoleArn: chatbotRole.roleArn,
      slackWorkspaceId: props.monitoringSlackWorkspaceId,
      snsTopicArns: [topic.topicArn],
    });
  }
}
