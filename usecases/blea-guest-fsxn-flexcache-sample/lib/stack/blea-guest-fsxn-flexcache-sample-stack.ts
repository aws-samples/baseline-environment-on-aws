import { Stack, StackProps } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { OriginNetworking } from '../construct/origin-networking';
import { CacheNetworking } from '../construct/cache-networking';
import { CrossRegionConnectivity } from '../construct/cross-region-connectivity';
import { OriginFsxn } from '../construct/origin-fsxn';
import { CacheFsxn } from '../construct/cache-fsxn';
import { FlexCacheResource } from '../construct/flexcache-resource';
import { Monitoring } from '../construct/monitoring';
import { S3AccessPoint } from '../construct/s3-access-point';

export interface BLEAFsxnFlexCacheStackProps extends StackProps {
  envName: string;
  monitoringNotifyEmail?: string;
  monitoringSlackWorkspaceId?: string;
  monitoringSlackChannelId?: string;
  originVpcCidr: string;
  cacheVpcCidr: string;
  originFsxnStorageCapacityGiB: number;
  originFsxnThroughputCapacityMBps: number;
  originVolumeName: string;
  originVolumeSizeMiB: number;
  originJunctionPath: string;
  cacheFsxnStorageCapacityGiB: number;
  cacheFsxnThroughputCapacityMBps: number;
  cacheFsxnDeploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  flexcacheSizeMiB: number;
  flexcacheWriteBackEnabled: boolean;
  connectivityType: 'VPC_PEERING' | 'TRANSIT_GATEWAY';
  ontapSecretArn: string;
  cacheHitRatioAlarmThreshold?: number;
  cacheCapacityAlarmThresholdPercent?: number;
  enableS3AccessPoint?: boolean;
  s3AccessPointName?: string;
  s3ApFileSystemIdentityUser?: string;
}

export class BLEAFsxnFlexCacheStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAFsxnFlexCacheStackProps) {
    super(scope, id, props);

    const cmk = new Key(this, 'CMK', { enableKeyRotation: true, description: 'BLEA FSxN FlexCache CMK' });

    // Origin Site Networking
    const originNet = new OriginNetworking(this, 'OriginNetworking', {
      vpcCidr: props.originVpcCidr,
      cacheVpcCidr: props.cacheVpcCidr,
    });

    // Cache Site Networking
    const cacheNet = new CacheNetworking(this, 'CacheNetworking', {
      vpcCidr: props.cacheVpcCidr,
      originVpcCidr: props.originVpcCidr,
    });

    // Cross-VPC Connectivity
    new CrossRegionConnectivity(this, 'Connectivity', {
      originVpc: originNet.vpc,
      cacheVpc: cacheNet.vpc,
      connectivityType: props.connectivityType,
      originVpcCidr: props.originVpcCidr,
      cacheVpcCidr: props.cacheVpcCidr,
    });

    // Origin FSxN (Multi-AZ, authoritative data)
    const originFsxn = new OriginFsxn(this, 'OriginFsxn', {
      vpc: originNet.vpc,
      fsxnSecurityGroup: originNet.fsxnSecurityGroup,
      privateSubnetRouteTableIds: originNet.privateSubnetRouteTableIds,
      storageCapacityGiB: props.originFsxnStorageCapacityGiB,
      throughputCapacityMBps: props.originFsxnThroughputCapacityMBps,
      volumeName: props.originVolumeName,
      volumeSizeMiB: props.originVolumeSizeMiB,
      junctionPath: props.originJunctionPath,
      kmsKey: cmk,
    });

    // Cache FSxN (hosts FlexCache volume)
    const cacheFsxn = new CacheFsxn(this, 'CacheFsxn', {
      vpc: cacheNet.vpc,
      fsxnSecurityGroup: cacheNet.fsxnSecurityGroup,
      privateSubnetRouteTableIds: cacheNet.privateSubnetRouteTableIds,
      storageCapacityGiB: props.cacheFsxnStorageCapacityGiB,
      throughputCapacityMBps: props.cacheFsxnThroughputCapacityMBps,
      deploymentType: props.cacheFsxnDeploymentType,
      kmsKey: cmk,
    });

    // FlexCache Custom Resource (inter-cluster peering + FlexCache creation)
    new FlexCacheResource(this, 'FlexCache', {
      vpc: cacheNet.vpc,
      lambdaSecurityGroup: cacheNet.lambdaSecurityGroup,
      secretArn: props.ontapSecretArn,
      originFileSystemId: originFsxn.fileSystemId,
      cacheFileSystemId: cacheFsxn.fileSystemId,
      originSvmName: 'svm-origin',
      cacheSvmName: 'svm-cache',
      originVolumeName: props.originVolumeName,
      flexcacheSizeMiB: props.flexcacheSizeMiB,
      writeBackEnabled: props.flexcacheWriteBackEnabled,
    });

    // S3 Access Point (オプション: Origin ボリュームへの Analytics アクセス)
    if (props.enableS3AccessPoint) {
      new S3AccessPoint(this, 'S3AccessPoint', {
        volumeId: originFsxn.volumeId,
        s3AccessPointName: props.s3AccessPointName || 'fsxn-flexcache-origin',
        fileSystemIdentityUser: props.s3ApFileSystemIdentityUser || 'nobody',
      });
    }

    // Monitoring (custom metrics Lambda + alarms)
    new Monitoring(this, 'Monitoring', {
      monitoringNotifyEmail: props.monitoringNotifyEmail || '',
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId || '',
      monitoringSlackChannelId: props.monitoringSlackChannelId || '',
      vpc: cacheNet.vpc,
      lambdaSecurityGroup: cacheNet.lambdaSecurityGroup,
      secretArn: props.ontapSecretArn,
      cacheFileSystemId: cacheFsxn.fileSystemId,
      originFileSystemId: originFsxn.fileSystemId,
      cacheHitRatioAlarmThreshold: props.cacheHitRatioAlarmThreshold || 50,
      cacheCapacityAlarmThresholdPercent: props.cacheCapacityAlarmThresholdPercent || 80,
    });
  }
}
