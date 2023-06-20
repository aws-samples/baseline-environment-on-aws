import { Stack, Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Detection } from '../construct/detection';
import { Iam } from '../construct/iam';
import { Logging } from '../construct/logging';
import { Notification } from '../construct/notification';
import { BLEAGovBaseCtStackProps } from '../stack/blea-gov-base-ct-stack';

export class BLEAGovBaseCtStage extends Stage {
  constructor(scope: Construct, id: string, props: BLEAGovBaseCtStackProps) {
    super(scope, id, props);

    // Define a stack and associate same constructs as normal to this.
    const stack = new Stack(this, 'BLEAGovBaseCt', {
      tags: {
        Repository: 'aws-samples/baseline-environment-on-aws',
      },
    });

    new Iam(stack, 'Iam');

    // AWS CloudTrail configuration in Control Tower Landing Zone v3.0 will not create CloudWatch Logs LogGroup in each Guest Accounts.
    // And it will delete these LogGroups when AWS CloudTrial Configuration is disabled in case of updating Landing Zone version from older one.
    // BLEA should notify their alarms continuously. So, if there is no CloudTrail and CloudWatch Logs in Guest Account, BLEA creates them to notify the Alarms.
    const logging = new Logging(stack, 'Logging');

    // Security Alarms
    // !!! Need to setup SecurityHub, GuardDuty manually on Organizations Management account
    // AWS Config and CloudTrail are set up by Control Tower
    const detection = new Detection(stack, 'Detection', {
      notifyEmail: props.securityNotifyEmail,
      cloudTrailLogGroupName: logging.trailLogGroup.logGroupName,
    });

    if (!props.securitySlackWorkspaceId || !props.securitySlackChannelId) {
      throw new Error('securitySlackWorkspaceId and securitySlackChannelId are required');
    }

    new Notification(stack, 'Notification', {
      topicArn: detection.topic.topicArn,
      workspaceId: props.securitySlackWorkspaceId,
      channelId: props.securitySlackChannelId,
    });
  }
}
