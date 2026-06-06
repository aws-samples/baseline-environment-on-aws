import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_fsx as fsx, aws_kms as kms } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface OriginFsxnProps {
  vpc: ec2.IVpc;
  fsxnSecurityGroup: ec2.ISecurityGroup;
  privateSubnetRouteTableIds: string[];
  storageCapacityGiB: number;
  throughputCapacityMBps: number;
  volumeName: string;
  volumeSizeMiB: number;
  junctionPath: string;
  kmsKey: kms.IKey;
}

export class OriginFsxn extends Construct {
  /** CloudFormation FileSystem ID (fs-xxx) */
  public readonly fileSystemId: string;
  /** CloudFormation SVM ID (svm-xxx) */
  public readonly svmId: string;
  /** CloudFormation Volume ID (fsvol-xxx) */
  public readonly volumeId: string;

  constructor(scope: Construct, id: string, props: OriginFsxnProps) {
    super(scope, id);
    const subnets = props.vpc.isolatedSubnets;

    const fs = new fsx.CfnFileSystem(this, 'FileSystem', {
      fileSystemType: 'ONTAP',
      storageCapacity: props.storageCapacityGiB,
      subnetIds: subnets.map((s) => s.subnetId),
      securityGroupIds: [props.fsxnSecurityGroup.securityGroupId],
      kmsKeyId: props.kmsKey.keyArn,
      ontapConfiguration: {
        deploymentType: 'MULTI_AZ_1',
        throughputCapacity: props.throughputCapacityMBps,
        preferredSubnetId: subnets[0].subnetId,
        routeTableIds: props.privateSubnetRouteTableIds,
      },
    });
    fs.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.fileSystemId = fs.ref;

    const svm = new fsx.CfnStorageVirtualMachine(this, 'SVM', {
      fileSystemId: fs.ref,
      name: 'svm-origin',
      rootVolumeSecurityStyle: 'UNIX',
    });
    this.svmId = svm.ref;

    const vol = new fsx.CfnVolume(this, 'Volume', {
      volumeType: 'ONTAP',
      name: props.volumeName,
      ontapConfiguration: {
        storageVirtualMachineId: svm.ref,
        junctionPath: props.junctionPath,
        sizeInMegabytes: props.volumeSizeMiB.toString(),
        storageEfficiencyEnabled: 'true',
        tieringPolicy: { name: 'AUTO', coolingPeriod: 31 },
      },
    });
    vol.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.volumeId = vol.ref;
  }
}
