import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_eks as eks } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ComputeEksProps {
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.ISecurityGroup;
  nodeInstanceType?: string;
  nodeMinSize?: number;
  nodeMaxSize?: number;
}

/**
 * EKS Cluster prepared for Trident CSI integration with FSxN.
 *
 * NOTE: Full EKS cluster creation requires kubectlLayer (Lambda layer).
 * This construct outputs the configuration needed for Trident setup.
 * The actual cluster may be created via eksctl or separate CDK with kubectlLayer.
 *
 * Manual Trident setup after cluster creation:
 *   helm install trident netapp-trident/trident-operator -n trident --create-namespace
 * See doc/README_ja.md for full instructions.
 */
export class ComputeEks extends Construct {
  constructor(scope: Construct, id: string, props: ComputeEksProps) {
    super(scope, id);

    // CfnCluster (L1) - avoids kubectlLayer requirement of L2 eks.Cluster
    const clusterRole = new cdk.aws_iam.Role(this, 'ClusterRole', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy')],
    });

    const cluster = new eks.CfnCluster(this, 'Cluster', {
      roleArn: clusterRole.roleArn,
      resourcesVpcConfig: {
        subnetIds: props.vpc.isolatedSubnets.map((s) => s.subnetId),
        securityGroupIds: [props.ec2SecurityGroup.securityGroupId],
        endpointPrivateAccess: true,
        endpointPublicAccess: false,
      },
      version: '1.30',
    });

    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.ref });
    new cdk.CfnOutput(this, 'ClusterEndpoint', { value: cluster.attrEndpoint });
  }
}
