import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface OriginNetworkingProps {
  vpcCidr: string;
  cacheVpcCidr: string; // For inter-cluster SG rules
}

export class OriginNetworking extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly fsxnSecurityGroup: ec2.ISecurityGroup;
  public readonly privateSubnetRouteTableIds: string[];

  constructor(scope: Construct, id: string, props: OriginNetworkingProps) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ cidrMask: 24, name: 'Private', subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });
    this.privateSubnetRouteTableIds = this.vpc.isolatedSubnets.map((s) => s.routeTable.routeTableId);

    this.vpc.addGatewayEndpoint('S3', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    this.vpc.addInterfaceEndpoint('SecretsManager', { service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER });

    const fsxnSg = new ec2.SecurityGroup(this, 'FsxnSG', {
      vpc: this.vpc,
      description: 'Origin FSxN',
      allowAllOutbound: false,
    });
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(2049), 'NFS local');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(445), 'SMB local');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(443), 'ONTAP mgmt');
    // Inter-cluster ports from cache VPC
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.cacheVpcCidr), ec2.Port.tcp(11104), 'Intercluster LIF');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.cacheVpcCidr), ec2.Port.tcp(11105), 'Intercluster LIF');
    this.fsxnSecurityGroup = fsxnSg;
  }
}
