import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface NetworkingProps {
  vpcCidr: string;
}

export class Networking extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly fsxnSecurityGroup: ec2.ISecurityGroup;
  public readonly glueSecurityGroup: ec2.ISecurityGroup;
  public readonly privateSubnetRouteTableIds: string[];

  constructor(scope: Construct, id: string, props: NetworkingProps) {
    super(scope, id);

    // VPC with isolated private subnets only (no NAT, no IGW)
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
    this.vpc = vpc;

    // Collect route table IDs for FSxN Multi-AZ configuration
    this.privateSubnetRouteTableIds = vpc.isolatedSubnets.map(
      (subnet) => subnet.routeTable.routeTableId,
    );

    // S3 Gateway Endpoint
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Glue Interface Endpoint
    vpc.addInterfaceEndpoint('GlueEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.GLUE,
    });

    // Athena Interface Endpoint
    vpc.addInterfaceEndpoint('AthenaEndpoint', {
      service: new ec2.InterfaceVpcEndpointService(
        `com.amazonaws.${cdk.Stack.of(this).region}.athena`,
      ),
    });

    // Security Group for FSxN
    const fsxnSg = new ec2.SecurityGroup(this, 'FsxnSecurityGroup', {
      vpc,
      description: 'Security group for FSx for NetApp ONTAP',
      allowAllOutbound: false,
    });
    // NFS
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(111), 'NFS portmapper');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(635), 'NFS mountd');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(2049), 'NFS');
    // SMB
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(445), 'SMB');
    // iSCSI
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(3260), 'iSCSI');
    // ONTAP management
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(443), 'ONTAP REST API');
    this.fsxnSecurityGroup = fsxnSg;

    // Security Group for Glue Crawler
    const glueSg = new ec2.SecurityGroup(this, 'GlueSecurityGroup', {
      vpc,
      description: 'Security group for AWS Glue Crawler',
      allowAllOutbound: false,
    });
    // Outbound HTTPS to VPC endpoints
    glueSg.addEgressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(443), 'HTTPS to VPC Endpoints');
    // Self-referencing rule for Glue Spark (required for Glue connections)
    glueSg.addIngressRule(glueSg, ec2.Port.allTraffic(), 'Self-referencing for Glue Spark');
    this.glueSecurityGroup = glueSg;
  }
}
