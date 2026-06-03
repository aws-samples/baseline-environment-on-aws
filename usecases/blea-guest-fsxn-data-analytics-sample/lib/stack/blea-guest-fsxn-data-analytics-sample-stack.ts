import { Stack, StackProps } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Networking } from '../construct/networking';
import { FsxnStorage } from '../construct/fsxn-storage';
import { S3AccessPoint } from '../construct/s3-access-point';
import { DataAnalytics } from '../construct/data-analytics';
import { Monitoring } from '../construct/monitoring';

export interface BLEAFsxnDataAnalyticsStackProps extends StackProps {
  envName: string;
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;
  fsxnStorageCapacityGiB: number;
  fsxnThroughputCapacityMBps: number;
  fsxnDeploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  fsxnSvmName: string;
  fsxnVolumeName: string;
  fsxnVolumeSizeMiB: number;
  fsxnJunctionPath: string;
  s3AccessPointName: string;
  s3ApFileSystemIdentityUser: string;
  glueDatabaseName: string;
  glueCrawlerName: string;
  glueCrawlerSchedule: string;
  athenaWorkgroupName: string;
}

export class BLEAFsxnDataAnalyticsStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAFsxnDataAnalyticsStackProps) {
    super(scope, id, props);

    // CMK for encryption at rest (shared across constructs)
    const cmk = new Key(this, 'CMK', {
      enableKeyRotation: true,
      description: 'BLEA FSxN Data Analytics: Customer managed key for encryption at rest',
    });

    // 1. Networking (VPC, subnets, endpoints, security groups)
    const networking = new Networking(this, 'Networking', {
      vpcCidr: props.vpcCidr,
    });

    // 2. FSx for NetApp ONTAP Storage
    const fsxnStorage = new FsxnStorage(this, 'FsxnStorage', {
      vpc: networking.vpc,
      fsxnSecurityGroup: networking.fsxnSecurityGroup,
      privateSubnetRouteTableIds: networking.privateSubnetRouteTableIds,
      storageCapacityGiB: props.fsxnStorageCapacityGiB,
      throughputCapacityMBps: props.fsxnThroughputCapacityMBps,
      deploymentType: props.fsxnDeploymentType,
      svmName: props.fsxnSvmName,
      volumeName: props.fsxnVolumeName,
      volumeSizeMiB: props.fsxnVolumeSizeMiB,
      junctionPath: props.fsxnJunctionPath,
      kmsKey: cmk,
    });

    // 3. S3 Access Point (Internet-origin for Athena/Glue)
    const s3Ap = new S3AccessPoint(this, 'S3AccessPoint', {
      volumeId: fsxnStorage.volumeId,
      accessPointName: props.s3AccessPointName,
      fileSystemIdentityUser: props.s3ApFileSystemIdentityUser,
    });

    // 4. Data Analytics (Glue + Athena)
    new DataAnalytics(this, 'DataAnalytics', {
      s3AccessPointArn: s3Ap.accessPointArn,
      s3AccessPointAlias: s3Ap.accessPointAlias,
      glueDatabaseName: props.glueDatabaseName,
      glueCrawlerName: props.glueCrawlerName,
      glueCrawlerSchedule: props.glueCrawlerSchedule,
      athenaWorkgroupName: props.athenaWorkgroupName,
      kmsKey: cmk,
    });

    // 5. Monitoring (Alarms + SNS + Chatbot)
    new Monitoring(this, 'Monitoring', {
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
      fileSystemId: fsxnStorage.fileSystemId,
    });
  }
}
