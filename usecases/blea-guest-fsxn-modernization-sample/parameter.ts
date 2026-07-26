import { Environment } from 'aws-cdk-lib';

export interface AppParameter {
  env?: Environment;
  envName: string;
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;

  // FSxN Storage
  fsxnStorageCapacityGiB: number;
  fsxnThroughputCapacityMBps: number;
  fsxnDeploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  fsxnNfsVolumeSizeMiB: number;
  fsxnJunctionPath: string;
  s3AccessPointName: string;
  s3ApFileSystemIdentityUser: string;

  // Compute Pattern Toggles
  enableEc2Pattern: boolean;
  enableLambdaPattern: boolean;
  enableEcsPattern: boolean;
  enableEksPattern: boolean;
  enableBatchPattern: boolean;

  // EC2 config
  ec2InstanceType?: string;
  ec2MinCapacity?: number;
  ec2MaxCapacity?: number;

  // Batch config
  batchMaxVcpus?: number;
  batchUseSpot?: boolean;

  // Data Protection
  backupRetentionDays: number;

  // Serverless Ops
  capacityAlarmThresholdPercent: number;
  maxCapacityGiB: number;
}

export const devParameter: AppParameter = {
  envName: 'Development',
  monitoringNotifyEmail: 'notify-monitoring@example.com',
  monitoringSlackWorkspaceId: '',
  monitoringSlackChannelId: '',
  vpcCidr: '10.0.0.0/16',
  fsxnStorageCapacityGiB: 1024,
  fsxnThroughputCapacityMBps: 128,
  fsxnDeploymentType: 'SINGLE_AZ_1',
  fsxnNfsVolumeSizeMiB: 102400,
  fsxnJunctionPath: '/shared',
  s3AccessPointName: 'fsxn-platform-dev',
  s3ApFileSystemIdentityUser: 'nobody',
  enableEc2Pattern: true,
  enableLambdaPattern: true,
  enableEcsPattern: false,
  enableEksPattern: false,
  enableBatchPattern: false,
  ec2InstanceType: 't3.medium',
  ec2MinCapacity: 1,
  ec2MaxCapacity: 2,
  batchMaxVcpus: 16,
  batchUseSpot: false,
  backupRetentionDays: 7,
  capacityAlarmThresholdPercent: 80,
  maxCapacityGiB: 2048,
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};

export const prodParameter: AppParameter = {
  envName: 'Production',
  monitoringNotifyEmail: 'notify-monitoring@example.com',
  monitoringSlackWorkspaceId: '',
  monitoringSlackChannelId: '',
  vpcCidr: '10.0.0.0/16',
  fsxnStorageCapacityGiB: 4096,
  fsxnThroughputCapacityMBps: 1024,
  fsxnDeploymentType: 'MULTI_AZ_1',
  fsxnNfsVolumeSizeMiB: 512000,
  fsxnJunctionPath: '/shared',
  s3AccessPointName: 'fsxn-platform-prod',
  s3ApFileSystemIdentityUser: 'platform-svc',
  enableEc2Pattern: true,
  enableLambdaPattern: true,
  enableEcsPattern: true,
  enableEksPattern: false,
  enableBatchPattern: true,
  ec2InstanceType: 'm5.xlarge',
  ec2MinCapacity: 2,
  ec2MaxCapacity: 10,
  batchMaxVcpus: 64,
  batchUseSpot: true,
  backupRetentionDays: 30,
  capacityAlarmThresholdPercent: 80,
  maxCapacityGiB: 8192,
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};
