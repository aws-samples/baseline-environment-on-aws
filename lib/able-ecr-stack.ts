import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as eventtarget from '@aws-cdk/aws-events-targets';
import * as sns from '@aws-cdk/aws-sns';

export interface ABLEEcrProps extends cdk.NestedStackProps {
  repositoryName: string,
  alarmTopic: sns.Topic
}

export class ABLEEcrStack extends cdk.NestedStack {
  repository: ecr.Repository;
  constructor(scope: cdk.Construct, id: string, props: ABLEEcrProps) {
    super(scope, id, props);

    // Create a repository
    this.repository = new ecr.Repository(this, props.repositoryName, {
      imageScanOnPush: true
    });
    const options = this.repository.onImageScanCompleted('ImageScanComplete')
      .addTarget(new eventtarget.SnsTopic(props.alarmTopic));

  }
}
