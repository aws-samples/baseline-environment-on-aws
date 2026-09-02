import { Environment } from 'aws-cdk-lib';

export interface AppParameter {
  env?: Environment;
  envName: string;
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;

  // Origin Site
  originVpcCidr: string;
  originFsxnStorageCapacityGiB: number;
  originFsxnThroughputCapacityMBps: number;
  originVolumeName: string;
  originVolumeSizeMiB: number;
  originJunctionPath: string;

  // Cache Site
  cacheVpcCidr: string;
  cacheFsxnStorageCapacityGiB: number;
  cacheFsxnThroughputCapacityMBps: number;
  cacheFsxnDeploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';

  // FlexCache
  flexcacheSizeMiB: number;
  flexcacheWriteBackEnabled: boolean;

  // Connectivity
  connectivityType: 'VPC_PEERING' | 'TRANSIT_GATEWAY';

  // ONTAP Custom Resource
  ontapSecretArn: string;

  // Optional S3 Access Point on FlexCache
  enableS3AccessPoint: boolean;
  s3AccessPointName?: string;

  // Monitoring thresholds
  cacheHitRatioAlarmThreshold: number;
  cacheCapacityAlarmThresholdPercent: number;
}

export const devParameter: AppParameter = {
  envName: 'Development',
  monitoringNotifyEmail: 'notify-monitoring@example.com',
  monitoringSlackWorkspaceId: '',
  monitoringSlackChannelId: '',
  originVpcCidr: '10.0.0.0/16',
  originFsxnStorageCapacityGiB: 1024,
  originFsxnThroughputCapacityMBps: 128,
  originVolumeName: 'vol_source',
  originVolumeSizeMiB: 102400,
  originJunctionPath: '/data',
  cacheVpcCidr: '10.1.0.0/16',
  cacheFsxnStorageCapacityGiB: 1024,
  cacheFsxnThroughputCapacityMBps: 128,
  cacheFsxnDeploymentType: 'SINGLE_AZ_1',
  flexcacheSizeMiB: 51200,
  flexcacheWriteBackEnabled: false,
  connectivityType: 'VPC_PEERING',
  ontapSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:fsxn-admin-XXXXXX',
  enableS3AccessPoint: false,
  cacheHitRatioAlarmThreshold: 50,
  cacheCapacityAlarmThresholdPercent: 80,
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};
