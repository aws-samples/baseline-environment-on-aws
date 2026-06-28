import { Environment } from 'aws-cdk-lib';

export interface AppParameter {
  env?: Environment;
  envName: string;

  // Stack protection
  terminationProtection?: boolean;

  // Monitoring
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;

  // Networking
  vpcCidr: string;

  // FSx for ONTAP
  fsxnStorageCapacityGiB: number;
  fsxnThroughputCapacityMBps: number;
  fsxnDeploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  fsxnSvmName: string;
  fsxnVolumeName: string;
  fsxnVolumeSizeMiB: number;
  fsxnJunctionPath: string;
  fsxnAutomaticBackupRetentionDays: number;
  fsxnDailyAutomaticBackupStartTime: string;

  // S3 Access Point
  s3AccessPointName: string;
  s3ApFileSystemIdentityUser: string;

  // Data Analytics
  glueDatabaseName: string;
  glueCrawlerName: string;
  glueCrawlerSchedule: string;
  athenaWorkgroupName: string;
}

// Development: cost-effective single-AZ configuration
export const devParameter: AppParameter = {
  envName: 'Development',
  monitoringNotifyEmail: 'notify-monitoring@example.com',
  monitoringSlackWorkspaceId: '',
  monitoringSlackChannelId: '',
  vpcCidr: '10.0.0.0/16',
  fsxnStorageCapacityGiB: 1024,
  fsxnThroughputCapacityMBps: 128,
  fsxnDeploymentType: 'SINGLE_AZ_1',
  fsxnSvmName: 'svm-analytics',
  fsxnVolumeName: 'vol_data',
  fsxnVolumeSizeMiB: 102400,
  fsxnJunctionPath: '/data',
  fsxnAutomaticBackupRetentionDays: 7,
  fsxnDailyAutomaticBackupStartTime: '17:00',
  s3AccessPointName: 'fsxn-analytics-dev',
  s3ApFileSystemIdentityUser: 'nobody',
  glueDatabaseName: 'fsxn_analytics_db',
  glueCrawlerName: 'fsxn-data-crawler',
  glueCrawlerSchedule: 'cron(0 2 * * ? *)',
  athenaWorkgroupName: 'fsxn-analytics',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};

// Production: high-availability multi-AZ configuration
export const prodParameter: AppParameter = {
  envName: 'Production',
  terminationProtection: true,
  monitoringNotifyEmail: 'notify-monitoring@example.com',
  monitoringSlackWorkspaceId: 'T8XXXXXXX',
  monitoringSlackChannelId: 'C00XXXXXXXX',
  vpcCidr: '10.0.0.0/16',
  fsxnStorageCapacityGiB: 2048,
  fsxnThroughputCapacityMBps: 512,
  fsxnDeploymentType: 'MULTI_AZ_1',
  fsxnSvmName: 'svm-analytics',
  fsxnVolumeName: 'vol_data',
  fsxnVolumeSizeMiB: 512000,
  fsxnJunctionPath: '/data',
  fsxnAutomaticBackupRetentionDays: 30,
  fsxnDailyAutomaticBackupStartTime: '17:00',
  s3AccessPointName: 'fsxn-analytics-prod',
  s3ApFileSystemIdentityUser: 'analytics-svc',
  glueDatabaseName: 'fsxn_analytics_db',
  glueCrawlerName: 'fsxn-data-crawler',
  glueCrawlerSchedule: 'cron(0 2 * * ? *)',
  athenaWorkgroupName: 'fsxn-analytics',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};
