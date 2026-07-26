import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_fsx as fsx, aws_kms as kms } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface FsxnStorageProps {
  vpc: ec2.IVpc;
  fsxnSecurityGroup: ec2.ISecurityGroup;
  privateSubnetRouteTableIds: string[];
  storageCapacityGiB: number;
  throughputCapacityMBps: number;
  deploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  nfsVolumeSizeMiB: number;
  junctionPath: string;
  s3AccessPointName: string;
  s3ApFileSystemIdentityUser: string;
  kmsKey: kms.IKey;
}

export class FsxnStorage extends Construct {
  /** CloudFormation FileSystem ID (fs-xxx) */
  public readonly fileSystemId: string;
  /** CloudFormation Volume ID (fsvol-xxx) */
  public readonly nfsVolumeId: string;
  /** SVM NFS DNS endpoint for mount operations */
  public readonly nfsDnsName: string;
  /** S3 Access Point ARN for IAM policy scoping */
  public readonly s3AccessPointArn: string;
  /** S3 Access Point alias for bucket-style access (e.g., name-hash-ext-s3alias) */
  public readonly s3AccessPointAlias: string;

  constructor(scope: Construct, id: string, props: FsxnStorageProps) {
    super(scope, id);

    const subnets = props.vpc.isolatedSubnets;

    const fileSystem = new fsx.CfnFileSystem(this, 'FileSystem', {
      fileSystemType: 'ONTAP',
      storageCapacity: props.storageCapacityGiB,
      subnetIds: props.deploymentType === 'MULTI_AZ_1' ? subnets.map((s) => s.subnetId) : [subnets[0].subnetId],
      securityGroupIds: [props.fsxnSecurityGroup.securityGroupId],
      kmsKeyId: props.kmsKey.keyArn,
      ontapConfiguration: {
        deploymentType: props.deploymentType,
        throughputCapacity: props.throughputCapacityMBps,
        preferredSubnetId: subnets[0].subnetId,
        ...(props.deploymentType === 'MULTI_AZ_1' && { routeTableIds: props.privateSubnetRouteTableIds }),
      },
    });
    fileSystem.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.fileSystemId = fileSystem.ref;

    const svm = new fsx.CfnStorageVirtualMachine(this, 'SVM', {
      fileSystemId: fileSystem.ref,
      name: 'svm-platform',
      rootVolumeSecurityStyle: 'UNIX',
    });

    // NFS Volume (shared across EC2/ECS/EKS/Batch)
    const nfsVolume = new fsx.CfnVolume(this, 'NfsVolume', {
      volumeType: 'ONTAP',
      name: 'vol_shared',
      ontapConfiguration: {
        storageVirtualMachineId: svm.ref,
        junctionPath: props.junctionPath,
        sizeInMegabytes: props.nfsVolumeSizeMiB.toString(),
        storageEfficiencyEnabled: 'true',
        tieringPolicy: { name: 'AUTO', coolingPeriod: 31 },
      },
    });
    nfsVolume.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.nfsVolumeId = nfsVolume.ref;
    this.nfsDnsName = `svm-platform.${fileSystem.ref}.fsx.${cdk.Stack.of(this).region}.amazonaws.com`;

    // S3 Access Point (for Lambda serverless access)
    const s3Ap = new fsx.CfnS3AccessPointAttachment(this, 'S3AccessPoint', {
      name: props.s3AccessPointName,
      type: 'ONTAP',
      ontapConfiguration: {
        volumeId: nfsVolume.ref,
        fileSystemIdentity: {
          type: 'UNIX',
          unixUser: { name: props.s3ApFileSystemIdentityUser },
        },
      },
    });
    this.s3AccessPointArn = s3Ap.getAtt('S3AccessPoint.ResourceARN').toString();
    this.s3AccessPointAlias = s3Ap.getAtt('S3AccessPoint.Alias').toString();
  }
}
