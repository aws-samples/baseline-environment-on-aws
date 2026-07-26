import * as cdk from 'aws-cdk-lib';
import { aws_autoscaling as asg, aws_ec2 as ec2, aws_iam as iam } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ComputeEc2Props {
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.ISecurityGroup;
  nfsDnsName: string;
  junctionPath: string;
  instanceType: string;
  minCapacity: number;
  maxCapacity: number;
}

/**
 * EC2 Auto Scaling Group with NFS mount to FSxN.
 * Pattern: Legacy application rehost (VMware → EC2).
 */
export class ComputeEc2 extends Construct {
  constructor(scope: Construct, id: string, props: ComputeEc2Props) {
    super(scope, id);

    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'yum install -y nfs-utils',
      'mkdir -p /mnt/fsxn',
      `mount -t nfs -o noresvport,hard,nfsvers=4.1,rsize=262144,wsize=262144 ${props.nfsDnsName}:${props.junctionPath} /mnt/fsxn`,
      `echo "${props.nfsDnsName}:${props.junctionPath} /mnt/fsxn nfs noresvport,hard,nfsvers=4.1,rsize=262144,wsize=262144 0 0" >> /etc/fstab`,
    );

    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      instanceType: new ec2.InstanceType(props.instanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: props.ec2SecurityGroup,
      role,
      userData,
    });

    new asg.AutoScalingGroup(this, 'ASG', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      launchTemplate,
      minCapacity: props.minCapacity,
      maxCapacity: props.maxCapacity,
    });
  }
}
