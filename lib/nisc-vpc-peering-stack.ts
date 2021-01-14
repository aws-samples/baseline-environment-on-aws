import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';

export interface NiscVpcPeeringStackProps extends cdk.StackProps {
  srcVpcId: string,
  srcVpcCidr: string,
  srcRouteTableIds: string[],
  dstVpcId: string,
  dstVpcCidr: string,
  dstRouteTableIds: string[],
}

export class NiscVpcPeeringStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: NiscVpcPeeringStackProps) {
    super(scope, id, props);

    // Create VPC Peering
    const cfnVPCPeeringMgmtProd = new ec2.CfnVPCPeeringConnection(this, 'peeringMgmtAndProd', {
      vpcId: props.srcVpcId,
      peerVpcId: props.dstVpcId
    });

    // Add route for RouteTables
    var i=0;
    props.dstRouteTableIds.forEach(dstRouteTableId => {
      new ec2.CfnRoute(this, 'routeToSrc'+(i++), {
        routeTableId: dstRouteTableId,
        destinationCidrBlock: props.srcVpcCidr,
        vpcPeeringConnectionId: cfnVPCPeeringMgmtProd.ref
      });
    });

    var i=0;
    props.srcRouteTableIds.forEach(srcRouteTableId => {
      new ec2.CfnRoute(this, 'routeToDst'+(i++), {
        routeTableId: srcRouteTableId,
        destinationCidrBlock: props.dstVpcCidr,
        vpcPeeringConnectionId: cfnVPCPeeringMgmtProd.ref
      });
    });


  }
}
