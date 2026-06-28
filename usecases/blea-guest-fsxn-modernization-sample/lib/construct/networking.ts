import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface NetworkingProps {
  vpcCidr: string;
  enableEc2Pattern: boolean;
  enableLambdaPattern: boolean;
  enableEcsPattern: boolean;
}

export class Networking extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly fsxnSecurityGroup: ec2.ISecurityGroup;
  public readonly lambdaSecurityGroup: ec2.ISecurityGroup;
  public readonly ec2SecurityGroup: ec2.ISecurityGroup;
  public readonly privateSubnetRouteTableIds: string[];

  constructor(scope: Construct, id: string, props: NetworkingProps) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ cidrMask: 24, name: 'Private', subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });
    this.vpc = vpc;
    this.privateSubnetRouteTableIds = vpc.isolatedSubnets.map((s) => s.routeTable.routeTableId);

    // VPC Endpoints (always deployed)
    vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    vpc.addInterfaceEndpoint('CWLogsEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS });

    // Conditional endpoints
    if (props.enableEc2Pattern) {
      vpc.addInterfaceEndpoint('SSMEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.SSM });
      vpc.addInterfaceEndpoint('SSMMessagesEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES });
    }

    // ECS Fargate: ECR + ECR Docker endpoints required for image pull in isolated subnet
    if (props.enableEcsPattern) {
      vpc.addInterfaceEndpoint('EcrEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.ECR });
      vpc.addInterfaceEndpoint('EcrDockerEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER });
    }

    // Security Groups
    const fsxnSg = new ec2.SecurityGroup(this, 'FsxnSG', { vpc, description: 'FSxN', allowAllOutbound: false });
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(2049), 'NFS');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(445), 'SMB');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(443), 'ONTAP mgmt');
    this.fsxnSecurityGroup = fsxnSg;

    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSG', { vpc, description: 'Lambda', allowAllOutbound: true });
    this.lambdaSecurityGroup = lambdaSg;

    const ec2Sg = new ec2.SecurityGroup(this, 'EC2SG', { vpc, description: 'EC2', allowAllOutbound: true });
    this.ec2SecurityGroup = ec2Sg;
  }
}
