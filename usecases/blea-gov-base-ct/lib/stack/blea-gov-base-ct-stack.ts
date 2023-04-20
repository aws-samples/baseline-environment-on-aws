import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Iam } from '../construct/iam';
import { Logging } from '../construct/logging';
import { Detection } from '../construct/detection';
import { Notification } from '../construct/notification';

export interface BLEAGovBaseCtStackProps extends StackProps {
  securityNotifyEmail: string;
  securitySlackWorkspaceId?: string;
  securitySlackChannelId?: string;
}

export class BLEAGovBaseCtStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAGovBaseCtStackProps) {
    super(scope, id, props);

    new Iam(this, 'Iam');

    // AWS CloudTrail configuration in Control Tower Landing Zone v3.0 will not create CloudWatch Logs LogGroup in each Guest Accounts.
    // And it will delete these LogGroups when AWS CloudTrial Configuration is disabled in case of updating Landing Zone version from older one.
    // BLEA should notify their alarms continuously. So, if there is no CloudTrail and CloudWatch Logs in Guest Account, BLEA creates them to notify the Alarms.
    const logging = new Logging(this, 'Logging');

    // Security Alarms
    // !!! Need to setup SecurityHub, GuardDuty manually on Organizations Management account
    // AWS Config and CloudTrail are set up by Control Tower
    const detection = new Detection(this, 'Detection', {
      notifyEmail: props.securityNotifyEmail,
      cloudTrailLogGroupName: logging.trailLogGroup.logGroupName,
    });

    if (!props.securitySlackWorkspaceId || !props.securitySlackChannelId) {
      throw new Error('securitySlackWorkspaceId and securitySlackChannelId are required');
    }

    new Notification(this, 'Notification', {
      topicArn: detection.topic.topicArn,
      workspaceId: props.securitySlackWorkspaceId,
      channelId: props.securitySlackChannelId,
    });
  }
}
