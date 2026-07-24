import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface CrossRegionConnectivityProps {
  originVpc: ec2.Vpc;
  cacheVpc: ec2.Vpc;
  connectivityType: 'VPC_PEERING' | 'TRANSIT_GATEWAY';
  originVpcCidr: string;
  cacheVpcCidr: string;
}

/**
 * Cross-VPC connectivity for FlexCache inter-cluster communication.
 *
 * VPC Peering: simpler, lower cost for single origin-cache pair.
 * Transit Gateway: scalable for multi-site (3+ locations).
 *
 * Note (佐藤 review): Cross-REGION FlexCache requires Transit Gateway.
 * VPC Peering works only within the same region for intercluster LIF routing.
 */
export class CrossRegionConnectivity extends Construct {
  constructor(scope: Construct, id: string, props: CrossRegionConnectivityProps) {
    super(scope, id);

    if (props.connectivityType === 'VPC_PEERING') {
      const peering = new ec2.CfnVPCPeeringConnection(this, 'Peering', {
        vpcId: props.originVpc.vpcId,
        peerVpcId: props.cacheVpc.vpcId,
      });

      // Route: Origin → Cache
      for (const subnet of props.originVpc.isolatedSubnets) {
        new ec2.CfnRoute(this, `OriginRoute${subnet.node.id}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: props.cacheVpcCidr,
          vpcPeeringConnectionId: peering.ref,
        });
      }

      // Route: Cache → Origin
      for (const subnet of props.cacheVpc.isolatedSubnets) {
        new ec2.CfnRoute(this, `CacheRoute${subnet.node.id}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: props.originVpcCidr,
          vpcPeeringConnectionId: peering.ref,
        });
      }
    }
    // Transit Gateway implementation would go here for cross-region
  }
}
