import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Detection } from '../construct/detection';
import { Iam } from '../construct/iam';
import { Logging } from '../construct/logging';
import { Notification } from '../construct/notification';

export interface BLEAGovBaseStandaloneProps extends StackProps {
  securityNotifyEmail: string;
  securitySlackWorkspaceId: string;
  securitySlackChannelId: string;
}

export class BLEAGovBaseStandaloneStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAGovBaseStandaloneProps) {
    super(scope, id, props);

    new Iam(this, 'Iam');
    const logging = new Logging(this, 'Logging');
    const detection = new Detection(this, 'Detection', {
      cloudTrailLogGroupName: logging.trailLogGroup.logGroupName,
      notifyEmail: props.securityNotifyEmail,
    });

    // You must create a configuration recorder before you can create or update a Config rule.
    detection.node.addDependency(logging);

    new Notification(this, 'Notification', {
      topicArn: detection.topic.topicArn,
      workspaceId: props.securitySlackWorkspaceId,
      channelId: props.securitySlackChannelId,
    });
  }
}
