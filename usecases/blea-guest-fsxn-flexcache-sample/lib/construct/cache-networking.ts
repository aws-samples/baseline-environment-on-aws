import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface CacheNetworkingProps {
  vpcCidr: string;
  originVpcCidr: string;
}

export class CacheNetworking extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly fsxnSecurityGroup: ec2.ISecurityGroup;
  public readonly lambdaSecurityGroup: ec2.ISecurityGroup;
  public readonly privateSubnetRouteTableIds: string[];

  constructor(scope: Construct, id: string, props: CacheNetworkingProps) {
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
    this.vpc.addInterfaceEndpoint('CWLogs', { service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS });
    this.vpc.addInterfaceEndpoint('CWMonitoring', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_MONITORING,
    });

    const fsxnSg = new ec2.SecurityGroup(this, 'FsxnSG', {
      vpc: this.vpc,
      description: 'Cache FSxN',
      allowAllOutbound: false,
    });
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(2049), 'NFS local');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(445), 'SMB local');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(443), 'ONTAP mgmt');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.originVpcCidr), ec2.Port.tcp(11104), 'Intercluster from origin');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.originVpcCidr), ec2.Port.tcp(11105), 'Intercluster from origin');
    this.fsxnSecurityGroup = fsxnSg;

    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc: this.vpc,
      description: 'Lambda',
      allowAllOutbound: true,
    });
  }
}
