import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as trail from '@aws-cdk/aws-cloudtrail';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cwl from '@aws-cdk/aws-logs';
import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';


interface ABLEMonitorAlarmStackProps extends cdk.StackProps {
  notifyEmail: string
}


export class ABLEMonitorAlarmStack extends cdk.Stack {
  public readonly alarmTopic :sns.Topic;

  constructor(scope: cdk.Construct, id: string, props: ABLEMonitorAlarmStackProps) {
    super(scope, id, props);

    // SNS Topic for Monitoring Alarm
    const topic = new sns.Topic(this, 'MonitorAlarmTopic');
    new sns.Subscription(this, 'MonitorAlarmEmail', {
      endpoint: props.notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: topic
    });
    this.alarmTopic = topic;


  }

}
