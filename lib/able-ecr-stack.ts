import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as eventtarget from '@aws-cdk/aws-events-targets';
import * as sns from '@aws-cdk/aws-sns';

export interface ABLEEcrProps extends cdk.StackProps {
  repositoryName: string,
  alarmTopic: sns.Topic
}

export class ABLEEcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;
  constructor(scope: cdk.Construct, id: string, props: ABLEEcrProps) {
    super(scope, id, props);

    // Create a repository
    this.repository = new ecr.Repository(this, props.repositoryName, {
      imageScanOnPush: true
    });
    const target = new eventtarget.SnsTopic(props.alarmTopic);
    console.log(this);
    console.log(this.repository);
    console.log(target);
    const options = this.repository.onImageScanCompleted('ImageScanComplete')
      .addTarget(target);

  }
}
