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
  svmName: string;
  volumeName: string;
  volumeSizeMiB: number;
  junctionPath: string;
  kmsKey: kms.IKey;
}

export class FsxnStorage extends Construct {
  public readonly fileSystemId: string;
  public readonly volumeId: string;
  public readonly svmId: string;

  constructor(scope: Construct, id: string, props: FsxnStorageProps) {
    super(scope, id);

    const subnets = props.vpc.isolatedSubnets;

    // FSx for NetApp ONTAP File System
    const fileSystem = new fsx.CfnFileSystem(this, 'FileSystem', {
      fileSystemType: 'ONTAP',
      storageCapacity: props.storageCapacityGiB,
      subnetIds:
        props.deploymentType === 'MULTI_AZ_1'
          ? subnets.map((s) => s.subnetId)
          : [subnets[0].subnetId],
      securityGroupIds: [props.fsxnSecurityGroup.securityGroupId],
      kmsKeyId: props.kmsKey.keyArn,
      ontapConfiguration: {
        deploymentType: props.deploymentType,
        throughputCapacity: props.throughputCapacityMBps,
        preferredSubnetId: subnets[0].subnetId,
        // RouteTableIds is only supported for Multi-AZ deployments
        ...(props.deploymentType === 'MULTI_AZ_1' && {
          routeTableIds: props.privateSubnetRouteTableIds,
        }),
      },
    });
    fileSystem.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.fileSystemId = fileSystem.ref;

    // Storage Virtual Machine
    const svm = new fsx.CfnStorageVirtualMachine(this, 'StorageVirtualMachine', {
      fileSystemId: fileSystem.ref,
      name: props.svmName,
      rootVolumeSecurityStyle: 'UNIX',
    });
    this.svmId = svm.ref;

    // Volume with NFS access, storage efficiency, and FabricPool tiering
    const volume = new fsx.CfnVolume(this, 'Volume', {
      volumeType: 'ONTAP',
      name: props.volumeName,
      ontapConfiguration: {
        storageVirtualMachineId: svm.ref,
        junctionPath: props.junctionPath,
        sizeInMegabytes: props.volumeSizeMiB.toString(),
        storageEfficiencyEnabled: 'true',
        tieringPolicy: {
          name: 'AUTO',
          coolingPeriod: 31,
        },
      },
    });
    volume.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.volumeId = volume.ref;
  }
}
