import * as cdk from 'aws-cdk-lib';
import { aws_batch as batch, aws_ec2 as ec2, aws_ecs as ecs, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ComputeBatchProps {
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.ISecurityGroup;
  nfsDnsName: string;
  junctionPath: string;
  maxVcpus?: number;
  useSpot?: boolean;
}

/**
 * AWS Batch with NFS mount to FSxN for batch processing.
 *
 * Note: Spot instances may be interrupted. For NFS-mounted jobs,
 * ensure idempotent processing and checkpoint support.
 */
export class ComputeBatch extends Construct {
  constructor(scope: Construct, id: string, props: ComputeBatchProps) {
    super(scope, id);

    const computeEnv = new batch.ManagedEc2EcsComputeEnvironment(this, 'ComputeEnv', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.ec2SecurityGroup],
      maxvCpus: props.maxVcpus || 16,
      spot: props.useSpot || false,
    });

    const queue = new batch.JobQueue(this, 'JobQueue', {
      computeEnvironments: [{ computeEnvironment: computeEnv, order: 1 }],
    });

    // Job Definition with NFS mount (EC2 launch type)
    new batch.EcsJobDefinition(this, 'JobDef', {
      container: new batch.EcsEc2ContainerDefinition(this, 'Container', {
        image: ecs.ContainerImage.fromRegistry('public.ecr.aws/amazonlinux/amazonlinux:2023'),
        memory: cdk.Size.mebibytes(2048),
        cpu: 1,
        command: ['echo', 'Processing data from /mnt/fsxn'],
        volumes: [batch.EcsVolume.host({ name: 'fsxn', hostPath: '/mnt/fsxn', containerPath: '/mnt/fsxn' })],
      }),
    });
  }
}
