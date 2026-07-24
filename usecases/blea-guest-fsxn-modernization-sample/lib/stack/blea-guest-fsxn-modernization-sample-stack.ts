import { Stack, StackProps } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Networking } from '../construct/networking';
import { FsxnStorage } from '../construct/fsxn-storage';
import { ComputeEc2 } from '../construct/compute-ec2';
import { ComputeLambda } from '../construct/compute-lambda';
import { ComputeEcs } from '../construct/compute-ecs';
import { ComputeEks } from '../construct/compute-eks';
import { ComputeBatch } from '../construct/compute-batch';
import { Monitoring } from '../construct/monitoring';
import { ServerlessOps } from '../construct/serverless-ops';
import { DataProtection } from '../construct/data-protection';

export interface BLEAFsxnModernizationStackProps extends StackProps {
  envName: string;
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;
  fsxnStorageCapacityGiB: number;
  fsxnThroughputCapacityMBps: number;
  fsxnDeploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  fsxnNfsVolumeSizeMiB: number;
  fsxnJunctionPath: string;
  s3AccessPointName: string;
  s3ApFileSystemIdentityUser: string;
  enableEc2Pattern: boolean;
  enableLambdaPattern: boolean;
  enableEcsPattern: boolean;
  enableEksPattern: boolean;
  enableBatchPattern: boolean;
  ec2InstanceType?: string;
  ec2MinCapacity?: number;
  ec2MaxCapacity?: number;
  batchMaxVcpus?: number;
  batchUseSpot?: boolean;
  backupRetentionDays: number;
  capacityAlarmThresholdPercent: number;
  maxCapacityGiB: number;
}

export class BLEAFsxnModernizationStack extends Stack {
  constructor(scope: Construct, id: string, props: BLEAFsxnModernizationStackProps) {
    super(scope, id, props);

    const cmk = new Key(this, 'CMK', { enableKeyRotation: true, description: 'BLEA FSxN Modernization CMK' });

    // Networking
    const networking = new Networking(this, 'Networking', {
      vpcCidr: props.vpcCidr,
      enableEc2Pattern: props.enableEc2Pattern,
      enableLambdaPattern: props.enableLambdaPattern,
      enableEcsPattern: props.enableEcsPattern,
    });

    // FSxN Storage (shared across all compute patterns)
    const fsxnStorage = new FsxnStorage(this, 'FsxnStorage', {
      vpc: networking.vpc,
      fsxnSecurityGroup: networking.fsxnSecurityGroup,
      privateSubnetRouteTableIds: networking.privateSubnetRouteTableIds,
      storageCapacityGiB: props.fsxnStorageCapacityGiB,
      throughputCapacityMBps: props.fsxnThroughputCapacityMBps,
      deploymentType: props.fsxnDeploymentType,
      nfsVolumeSizeMiB: props.fsxnNfsVolumeSizeMiB,
      junctionPath: props.fsxnJunctionPath,
      s3AccessPointName: props.s3AccessPointName,
      s3ApFileSystemIdentityUser: props.s3ApFileSystemIdentityUser,
      kmsKey: cmk,
    });

    // Monitoring
    const monitoring = new Monitoring(this, 'Monitoring', {
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
      fileSystemId: fsxnStorage.fileSystemId,
      capacityAlarmThresholdPercent: props.capacityAlarmThresholdPercent,
    });

    // Serverless Ops: CapacityManager (auto-expand storage on alarm)
    new ServerlessOps(this, 'ServerlessOps', {
      vpc: networking.vpc,
      lambdaSecurityGroup: networking.lambdaSecurityGroup,
      fileSystemId: fsxnStorage.fileSystemId,
      alarmTopic: monitoring.alarmTopic,
      maxCapacityGiB: props.maxCapacityGiB,
    });

    // Conditional: EC2 Compute Pattern
    if (props.enableEc2Pattern) {
      new ComputeEc2(this, 'ComputeEc2', {
        vpc: networking.vpc,
        ec2SecurityGroup: networking.ec2SecurityGroup,
        nfsDnsName: fsxnStorage.nfsDnsName,
        junctionPath: props.fsxnJunctionPath,
        instanceType: props.ec2InstanceType || 't3.medium',
        minCapacity: props.ec2MinCapacity || 1,
        maxCapacity: props.ec2MaxCapacity || 2,
      });
    }

    // Conditional: Lambda Compute Pattern
    if (props.enableLambdaPattern) {
      new ComputeLambda(this, 'ComputeLambda', {
        vpc: networking.vpc,
        lambdaSecurityGroup: networking.lambdaSecurityGroup,
        s3AccessPointArn: fsxnStorage.s3AccessPointArn,
        s3AccessPointAlias: fsxnStorage.s3AccessPointAlias,
      });
    }

    // Conditional: ECS Fargate Pattern (S3 AP access, NOT NFS)
    if (props.enableEcsPattern) {
      new ComputeEcs(this, 'ComputeEcs', {
        vpc: networking.vpc,
        s3AccessPointArn: fsxnStorage.s3AccessPointArn,
      });
    }

    // Conditional: EKS Cluster Pattern (Trident CSI for NFS)
    if (props.enableEksPattern) {
      new ComputeEks(this, 'ComputeEks', {
        vpc: networking.vpc,
        ec2SecurityGroup: networking.ec2SecurityGroup,
      });
    }

    // Conditional: AWS Batch Pattern (NFS mount for batch processing)
    if (props.enableBatchPattern) {
      new ComputeBatch(this, 'ComputeBatch', {
        vpc: networking.vpc,
        ec2SecurityGroup: networking.ec2SecurityGroup,
        nfsDnsName: fsxnStorage.nfsDnsName,
        junctionPath: props.fsxnJunctionPath,
        maxVcpus: props.batchMaxVcpus || 16,
        useSpot: props.batchUseSpot || false,
      });
    }

    // Data Protection: AWS Backup
    new DataProtection(this, 'DataProtection', {
      fileSystemId: fsxnStorage.fileSystemId,
      backupRetentionDays: props.backupRetentionDays,
    });
  }
}
