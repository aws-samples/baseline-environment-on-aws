import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_events_targets as eventtarget } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';

export interface BLEAECRStackProps extends cdk.StackProps {
  repositoryName: string;
  alarmTopic: sns.Topic;
}

export class BLEAECRStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: BLEAECRStackProps) {
    super(scope, id, props);

    // Create a repository
    this.repository = new ecr.Repository(this, props.repositoryName, {
      imageScanOnPush: true,
    });
    const target = new eventtarget.SnsTopic(props.alarmTopic);

    this.repository.onImageScanCompleted('ImageScanComplete').addTarget(target);
  }
}
