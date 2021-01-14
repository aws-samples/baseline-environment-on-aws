import * as cdk from '@aws-cdk/core';
import * as cfn_inc from '@aws-cdk/cloudformation-include';
import * as ec2 from '@aws-cdk/aws-ec2';

export interface NiscVpcManagementStackProps extends cdk.StackProps {
  mgmtVpcCidr: string,
}

export class NiscVpcManagementStack extends cdk.Stack {
  public readonly mgmtVpc: ec2.Vpc;
  public readonly mgmtVpcId: string;
  public readonly mgmtRouteTableIds: string[];

  constructor(scope: cdk.Construct, id: string, props: NiscVpcManagementStackProps) {
    super(scope, id, props);


    const mgmtVpc = new ec2.Vpc(this, 'mgmtVpc', {
      cidr: props.mgmtVpcCidr,
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
          cidrMask: 24,
          name: 'Production App Subnet',
          subnetType: ec2.SubnetType.PRIVATE,
        },
     ]
    });

    const host = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc: mgmtVpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC }
    });

    // Property for Peering
    this.mgmtVpc = mgmtVpc;
    this.mgmtVpcId = mgmtVpc.vpcId;
    this.mgmtRouteTableIds = new Array();
    mgmtVpc.publicSubnets.forEach(subnet => {
      this.mgmtRouteTableIds.push((subnet as ec2.Subnet).routeTable.routeTableId);
    });
    mgmtVpc.privateSubnets.forEach(subnet => {
      this.mgmtRouteTableIds.push((subnet as ec2.Subnet).routeTable.routeTableId);
    });

  }
}
