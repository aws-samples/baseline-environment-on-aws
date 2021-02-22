import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';

export interface GcVpcProdStackProps extends cdk.StackProps {
  prodVpcCidr: string,
  vpcFlowLogsBucket: s3.Bucket
}


export class GcVpcProdStack extends cdk.Stack {
  public readonly prodVpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id: string, props: GcVpcProdStackProps) {
    super(scope, id, props);

    const prodVpc = new ec2.Vpc(this, 'Vpc', {
      cidr: props.prodVpcCidr,
      maxAzs: 2,
      natGateways: 1,
      flowLogs: {},
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 22,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE,
        },
        {
          cidrMask: 22,
          name: 'Protected',
          subnetType: ec2.SubnetType.ISOLATED,
        }
     ]
    });

    prodVpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(props.vpcFlowLogsBucket),
      trafficType: ec2.FlowLogTrafficType.ALL
    })
    this.prodVpc = prodVpc;



    // NACL for Public Subnets
    const naclPublic = new ec2.NetworkAcl(this, 'NaclPublic', {
      vpc: prodVpc,
      subnetSelection: {subnetType: ec2.SubnetType.PUBLIC}
    });

    // Egress Rules for Public Subnets
    naclPublic.addEntry('NaclEgressPublic', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    })

    // Ingress Rules for Public Subnets
    naclPublic.addEntry('NaclIngressPublic', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });


    // NACL for Private Subnets
    const naclPrivate = new ec2.NetworkAcl(this, 'NaclPrivate', {
      vpc: prodVpc,
      subnetSelection: {subnetType: ec2.SubnetType.PRIVATE}
    });

    // Egress Rules for Private Subnets
    naclPrivate.addEntry('NaclEgressPrivate', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    })

    // Ingress Rules for Public Subnets
    naclPrivate.addEntry('NaclIngressPrivate', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 120,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });

    // VPC Endpoint for S3
    prodVpc.addGatewayEndpoint("S3EndpointForPrivate", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE }]
    });
  }
}
