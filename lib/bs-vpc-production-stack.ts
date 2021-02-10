import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';

export interface BsVpcProdStackProps extends cdk.StackProps {
  prodVpcCidr: string,
  vpcFlowLogsBucket: s3.Bucket
}


export class BsVpcProdStack extends cdk.Stack {
  public readonly prodVpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id: string, props: BsVpcProdStackProps) {
    super(scope, id, props);

    const prodVpc = new ec2.Vpc(this, 'prodVpc', {
      cidr: props.prodVpcCidr,
      maxAzs: 2,
      natGateways: 1,
      flowLogs: {},
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'ProdPublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 22,
          name: 'ProdPrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE,
        },
        {
          cidrMask: 22,
          name: 'ProdProtectedSubnet',
          subnetType: ec2.SubnetType.PRIVATE,
        }
     ]
    });

    prodVpc.addFlowLog('prodFlowLogs', {
      destination: ec2.FlowLogDestination.toS3(props.vpcFlowLogsBucket),
      trafficType: ec2.FlowLogTrafficType.ALL
    })



    // Property for Peering
    this.prodVpc = prodVpc;
    // this.prodVpcId = prodVpc.vpcId;
    // this.prodRouteTableIds = new Array();
    // prodVpc.publicSubnets.forEach(subnet => {
    //   this.prodRouteTableIds.push((subnet as ec2.Subnet).routeTable.routeTableId);
    // });
    // prodVpc.privateSubnets.forEach(subnet => {
    //   this.prodRouteTableIds.push((subnet as ec2.Subnet).routeTable.routeTableId);
    // });


    // NACL for Public Subnets
    const naclPublic = new ec2.NetworkAcl(this, 'NACLPublic', {
      vpc: prodVpc,
      subnetSelection: {subnetType: ec2.SubnetType.PUBLIC}
    });

    // Egress Rules for Public Subnets
    naclPublic.addEntry('rNACLRuleAllowAllEgressPublic', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    })

    // Ingress Rules for Public Subnets
    naclPublic.addEntry('rNACLRuleAllowAllIngressPublic', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });


    // NACL for Private Subnets
    const naclPrivate = new ec2.NetworkAcl(this, 'NACLPrivate', {
      vpc: prodVpc,
      subnetSelection: {subnetType: ec2.SubnetType.PRIVATE}
    });

    // Egress Rules for Private Subnets
    naclPrivate.addEntry('rNACLRuleAllowAllEgressPrivate', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    })

    // Ingress Rules for Public Subnets
    naclPrivate.addEntry('rNACLRuleAllowAllIngressPrivate', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 120,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });
  }
}
