import * as cdk from '@aws-cdk/core';
import * as cfn_inc from '@aws-cdk/cloudformation-include';
import * as ec2 from '@aws-cdk/aws-ec2';

export interface NiscVpcProductionStackProps extends cdk.StackProps {
  prodVpcCidr: string
}


export class NiscVpcProductionStack extends cdk.Stack {
  public readonly prodVpc: ec2.Vpc;
  public readonly prodVpcId: string;
  public readonly prodRouteTableIds: string[];

  constructor(scope: cdk.Construct, id: string, props: NiscVpcProductionStackProps) {
    super(scope, id, props);

    const prodVpc = new ec2.Vpc(this, 'prodVpc', {
      cidr: props.prodVpcCidr,
      maxAzs: 2,
      natGateways: 1,
      flowLogs: {},
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Production DMZ Subnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 21,
          name: 'Production App Subnet',
          subnetType: ec2.SubnetType.PRIVATE,
        },
        {
          cidrMask: 21,
          name: 'Production DB Subnet',
          subnetType: ec2.SubnetType.PRIVATE,
        }
     ]
    });

    // Property for Peering
    this.prodVpc = prodVpc;
    this.prodVpcId = prodVpc.vpcId;
    this.prodRouteTableIds = new Array();
    prodVpc.publicSubnets.forEach(subnet => {
      this.prodRouteTableIds.push((subnet as ec2.Subnet).routeTable.routeTableId);
    });
    prodVpc.privateSubnets.forEach(subnet => {
      this.prodRouteTableIds.push((subnet as ec2.Subnet).routeTable.routeTableId);
    });


    // NACL for Public Subnets
    const naclPublic = new ec2.NetworkAcl(this, 'NACLPublic', {
      vpc: prodVpc,
      subnetSelection: {subnetType: ec2.SubnetType.PUBLIC}
    });

    // Egress Rules for Public Subnets
    naclPublic.addEntry('rNACLRuleAllowALLEgressPublic', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.ipv4('0.0.0.0/0'),
      traffic: ec2.AclTraffic.tcpPortRange(1, 65535),
      ruleAction: ec2.Action.ALLOW,
    })

    // Ingress Rules for Public Subnets
    naclPublic.addEntry('rNACLRuleAllowHTTPSPublic', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
      ruleNumber: 100,
      cidr: ec2.AclCidr.ipv4('0.0.0.0/0'),
      traffic: ec2.AclTraffic.tcpPort(443),
    });

    naclPublic.addEntry('rNACLRuleAllowAllReturnTCP', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 140,
      cidr: ec2.AclCidr.ipv4('0.0.0.0/0'),
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      ruleAction: ec2.Action.ALLOW,
    });

    naclPublic.addEntry('rNACLRuleAllowHTTPfromProd', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 200,
      cidr: ec2.AclCidr.ipv4(prodVpc.vpcCidrBlock),
      traffic: ec2.AclTraffic.tcpPort(22),
      ruleAction: ec2.Action.ALLOW,
    });

    naclPublic.addEntry('rNACLRuleAllowBastionSSHAccessPublic', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 210,
      cidr: ec2.AclCidr.ipv4('0.0.0.0/0'),
      traffic: ec2.AclTraffic.tcpPort(22),
      ruleAction: ec2.Action.ALLOW,
    });





    // NACL for Private Subnets
    const naclPrivate = new ec2.NetworkAcl(this, 'NACLPrivate', {
      vpc: prodVpc,
      subnetSelection: {subnetType: ec2.SubnetType.PRIVATE}
    });

    // Egress Rules for Private Subnets
    naclPrivate.addEntry('rNACLRuleAllowALLfromPrivEgress', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.ipv4('0.0.0.0/0'),
      traffic: ec2.AclTraffic.tcpPortRange(1, 65535),
      ruleAction: ec2.Action.ALLOW,
    })

    // Ingress Rules for Public Subnets
    naclPrivate.addEntry('rNACLRuleAllowAllTCPInternal', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.ALLOW,
      ruleNumber: 120,
      cidr: ec2.AclCidr.ipv4(prodVpc.vpcCidrBlock),
      traffic: ec2.AclTraffic.tcpPortRange(1, 65535),
    });

    naclPrivate.addEntry('rNACLRuleAllowAllReturnTCP', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 140,
      cidr: ec2.AclCidr.ipv4('0.0.0.0/0'),
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      ruleAction: ec2.Action.ALLOW,
    });

    const pManagementCIDR = '10.10.0.0/16';
    naclPrivate.addEntry('rNACLRuleAllowMgmtAccessSSHtoPrivate', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 125,
      cidr: ec2.AclCidr.ipv4(pManagementCIDR),
      traffic: ec2.AclTraffic.tcpPort(22),
      ruleAction: ec2.Action.ALLOW,
    });

    naclPrivate.addEntry('rNACLRuleAllowBastionSSHAccessPrivate', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 130,
      cidr: ec2.AclCidr.ipv4('0.0.0.0/0'),
      traffic: ec2.AclTraffic.tcpPort(22),
      ruleAction: ec2.Action.ALLOW,
    });

    naclPrivate.addEntry('rNACLRuleAllowReturnTCPPriv', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 140,
      cidr: ec2.AclCidr.ipv4('0.0.0.0/0'),
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
      ruleAction: ec2.Action.ALLOW,
    });

  }
}
