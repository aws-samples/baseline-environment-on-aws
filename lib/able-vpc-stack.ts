import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as s3 from '@aws-cdk/aws-s3';

export interface ABLEVpcStackProps extends cdk.StackProps {
  myVpcCidr: string,
  vpcFlowLogsBucket: s3.Bucket
}


export class ABLEVpcStack extends cdk.Stack {
  public readonly myVpc: ec2.Vpc;

  constructor(scope: cdk.Construct, id: string, props: ABLEVpcStackProps) {
    super(scope, id, props);

    const myVpc = new ec2.Vpc(this, 'Vpc', {
      cidr: props.myVpcCidr,
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

    myVpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(props.vpcFlowLogsBucket),
      trafficType: ec2.FlowLogTrafficType.ALL
    })
    this.myVpc = myVpc;



    // NACL for Public Subnets
    const naclPublic = new ec2.NetworkAcl(this, 'NaclPublic', {
      vpc: myVpc,
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
      vpc: myVpc,
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
    myVpc.addGatewayEndpoint("S3EndpointForPrivate", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        { subnetType: ec2.SubnetType.PRIVATE },
        { subnetType: ec2.SubnetType.ISOLATED }
      ]
    });

    // VPC Endpoint for SSM
    myVpc.addInterfaceEndpoint("SsmEndpointForPrivate", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      subnets: { subnetType: ec2.SubnetType.ISOLATED }
    });
    myVpc.addInterfaceEndpoint("SsmMessagesEndpointForPrivate", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
      subnets: { subnetType: ec2.SubnetType.ISOLATED }
    });
    myVpc.addInterfaceEndpoint("Ec2EndpointForPrivate", {
      service: ec2.InterfaceVpcEndpointAwsService.EC2,
      subnets: { subnetType: ec2.SubnetType.ISOLATED }
    });
    myVpc.addInterfaceEndpoint("Ec2MessagesEndpointForPrivate", {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
      subnets: { subnetType: ec2.SubnetType.ISOLATED }
    });

    // VPC Endpoint for Fargate
    myVpc.addInterfaceEndpoint("EcrDkrEndpointForPrivate", {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: { subnetType: ec2.SubnetType.ISOLATED }
    });
    myVpc.addInterfaceEndpoint("LogsEndpointForPrivate", {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: { subnetType: ec2.SubnetType.ISOLATED }
    });

  }
}
