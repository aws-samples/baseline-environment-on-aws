import { aws_fsx as fsx } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface S3AccessPointProps {
  volumeId: string;
  accessPointName: string;
  fileSystemIdentityUser: string;
}

export class S3AccessPoint extends Construct {
  public readonly accessPointArn: string;
  public readonly accessPointAlias: string;

  constructor(scope: Construct, id: string, props: S3AccessPointProps) {
    super(scope, id);

    // S3 Access Point Attachment for FSx for ONTAP
    // Internet-origin is required for managed services (Athena, Glue, Bedrock)
    const attachment = new fsx.CfnS3AccessPointAttachment(this, 'Attachment', {
      name: props.accessPointName,
      type: 'ONTAP',
      ontapConfiguration: {
        volumeId: props.volumeId,
        fileSystemIdentity: {
          type: 'UNIX',
          unixUser: {
            name: props.fileSystemIdentityUser,
          },
        },
      },
    });

    this.accessPointArn = attachment.getAtt('S3AccessPoint.ResourceARN').toString();
    this.accessPointAlias = attachment.getAtt('S3AccessPoint.Alias').toString();
  }
}
