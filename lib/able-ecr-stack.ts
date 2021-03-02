import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as eventtarget from '@aws-cdk/aws-events-targets'
import * as sns from '@aws-cdk/aws-sns';

export interface ABLEEcrProps extends cdk.StackProps {
  alarmTopic: sns.Topic
}

export class ABLEEcrStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ABLEEcrProps) {
    super(scope, id, props);
    const repository = new ecr.Repository(this, 'ContainerRepository', {
      imageScanOnPush: true
    });
    const options =
    repository.onImageScanCompleted('ImageScanComplete')
      .addTarget(new eventtarget.SnsTopic(props.alarmTopic));

  }
}
