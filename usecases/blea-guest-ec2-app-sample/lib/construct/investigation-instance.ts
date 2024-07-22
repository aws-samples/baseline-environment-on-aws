import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

export interface InvestigationInstanceProps {
  vpc: ec2.IVpc;
}

export class InvestigationInstance extends Construct {
  public readonly InvestigationInstanceSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: InvestigationInstanceProps) {
    super(scope, id);

    // Security Group
    const invInstanceSg = new ec2.SecurityGroup(this, 'InvInstanceSg', {
      vpc: props.vpc,
    });

    // InstanceProfile
    const ssmInstanceRole = new iam.Role(this, 'SsmInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      path: '/',
      managedPolicies: [
        { managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' },
        { managedPolicyArn: 'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy' },
      ],
    });

    // UserData
    const userdata = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userdata.addCommands('sudo yum -y install mariadb');

    const instance = new ec2.Instance(this, 'InvestigationInstance', {
      vpc: props.vpc,
      vpcSubnets: props.vpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      securityGroup: invInstanceSg,
      role: ssmInstanceRole,
      userData: userdata,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(10, {
            encrypted: true,
          }),
        },
      ],
    });

    // Tag
    cdk.Tags.of(instance).add('Name', 'Investigation');
  }
}
