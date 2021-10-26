import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import { Tags } from '@aws-cdk/core';

export interface BLEAInvestigationInstanceStackProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
}

export class BLEAInvestigationInstanceStack extends cdk.Stack {
  public readonly InvestigationInstanceSecurityGroup: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string, props: BLEAInvestigationInstanceStackProps) {
    super(scope, id, props);

    // Security Group
    const securityGroupForEc2 = new ec2.SecurityGroup(this, 'SgEC2', {
      vpc: props.myVpc,
    });

    // InstanceProfile
    const ssmInstanceRole = new iam.Role(this, 'ssm-instance-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      path: '/',
      managedPolicies: [
        { managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' },
        { managedPolicyArn: 'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy' },
      ],
    });

    // UserData
    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userData.addCommands('sudo yum -y install mariadb');

    const instance = new ec2.Instance(this, 'Investigation', {
      vpc: props.myVpc,
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      securityGroup: securityGroupForEc2,
      role: ssmInstanceRole,
      userData: userData,
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
    Tags.of(instance).add('Name', 'Investigation');
  }
}
