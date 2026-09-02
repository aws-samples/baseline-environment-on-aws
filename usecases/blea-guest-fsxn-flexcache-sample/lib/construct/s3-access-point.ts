import * as cdk from 'aws-cdk-lib';
import { aws_fsx as fsx } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface S3AccessPointProps {
  volumeId: string;
  s3AccessPointName: string;
  fileSystemIdentityUser: string;
}

/**
 * S3 Access Point for FSxN Origin Volume.
 * Analytics サービス (Athena, Glue, Bedrock) が Origin の NFS ボリュームにアクセス可能にする。
 * FlexCache 経由ではなく、Origin 側に直接アクセスするパターン。
 */
export class S3AccessPoint extends Construct {
  public readonly s3AccessPointArn: string;
  public readonly s3AccessPointAlias: string;

  constructor(scope: Construct, id: string, props: S3AccessPointProps) {
    super(scope, id);

    const attachment = new fsx.CfnS3AccessPointAttachment(this, 'Attachment', {
      name: props.s3AccessPointName,
      type: 'ONTAP',
      ontapConfiguration: {
        volumeId: props.volumeId,
        fileSystemIdentity: {
          // Deployment lesson #2: 'UNIX' (not 'UNIX_USER')
          type: 'UNIX',
          unixUser: { name: props.fileSystemIdentityUser },
        },
      },
    });

    this.s3AccessPointArn = attachment.getAtt('S3AccessPoint.ResourceARN').toString();
    this.s3AccessPointAlias = attachment.getAtt('S3AccessPoint.Alias').toString();

    new cdk.CfnOutput(this, 'S3APAlias', {
      value: this.s3AccessPointAlias,
      description: 'S3 Access Point alias for analytics service access',
    });
  }
}
