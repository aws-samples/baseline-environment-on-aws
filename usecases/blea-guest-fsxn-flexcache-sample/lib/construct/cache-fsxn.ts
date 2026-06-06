import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_fsx as fsx, aws_kms as kms } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface CacheFsxnProps {
  vpc: ec2.IVpc;
  fsxnSecurityGroup: ec2.ISecurityGroup;
  privateSubnetRouteTableIds: string[];
  storageCapacityGiB: number;
  throughputCapacityMBps: number;
  deploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  kmsKey: kms.IKey;
}

/**
 * Cache FSxN: hosts FlexCache volumes (created by Custom Resource, not CFn).
 * No regular volumes — FlexCache is created via ONTAP REST API.
 */
export class CacheFsxn extends Construct {
  public readonly fileSystemId: string;
  public readonly svmId: string;

  constructor(scope: Construct, id: string, props: CacheFsxnProps) {
    super(scope, id);
    const subnets = props.vpc.isolatedSubnets;

    const fs = new fsx.CfnFileSystem(this, 'FileSystem', {
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
    fs.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    this.fileSystemId = fs.ref;

    const svm = new fsx.CfnStorageVirtualMachine(this, 'SVM', {
      fileSystemId: fs.ref,
      name: 'svm-cache',
      rootVolumeSecurityStyle: 'UNIX',
    });
    this.svmId = svm.ref;
  }
}
