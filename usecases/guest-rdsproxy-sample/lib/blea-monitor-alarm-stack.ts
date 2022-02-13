import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';

interface BLEAMonitorAlarmStackProps extends cdk.StackProps {
  notifyEmail: string;
}

export class BLEAMonitorAlarmStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: BLEAMonitorAlarmStackProps) {
    super(scope, id, props);

    // SNS Topic for Monitoring Alarm
    const topic = new sns.Topic(this, 'MonitorAlarmTopic');
    new sns.Subscription(this, 'MonitorAlarmEmail', {
      endpoint: props.notifyEmail,
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
  }
}
