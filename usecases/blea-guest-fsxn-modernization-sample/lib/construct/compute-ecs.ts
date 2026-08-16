import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_ecs as ecs, aws_iam as iam, aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ComputeEcsProps {
  vpc: ec2.IVpc;
  s3AccessPointArn: string;
  /** Container image. Defaults to public nginx for demo. Use Private ECR in production. */
  containerImage?: ecs.ContainerImage;
  desiredCount?: number;
}

/**
 * ECS Fargate with S3 Access Point access to FSxN data.
 *
 * IMPORTANT: Fargate does NOT support direct NFS mount to FSxN.
 * This pattern uses S3 AP (VPC-origin) via AWS SDK for data access.
 * For POSIX file system semantics, use EC2 pattern with NFS mount instead.
 */
export class ComputeEcs extends Construct {
  constructor(scope: Construct, id: string, props: ComputeEcsProps) {
    super(scope, id);

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc: props.vpc });

    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // S3 AP access (same as Lambda pattern — serverless data access)
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [props.s3AccessPointArn, `${props.s3AccessPointArn}/object/*`],
      }),
    );

    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole,
    });

    taskDef.addContainer('App', {
      image: props.containerImage || ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs-fsxn',
        logGroup: new logs.LogGroup(this, 'LogGroup', { retention: logs.RetentionDays.ONE_MONTH }),
      }),
      environment: {
        S3_AP_ARN: props.s3AccessPointArn,
      },
    });

    new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: props.desiredCount || 0, // Default 0: scale up after ECR VPC Endpoint validation
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
  }
}
