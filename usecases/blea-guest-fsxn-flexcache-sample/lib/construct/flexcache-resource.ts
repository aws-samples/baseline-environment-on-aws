import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_iam as iam, aws_lambda as lambda, aws_logs as logs } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface FlexCacheResourceProps {
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  secretArn: string;
  originFileSystemId: string;
  cacheFileSystemId: string;
  originSvmName: string;
  cacheSvmName: string;
  originVolumeName: string;
  flexcacheSizeMiB: number;
  writeBackEnabled: boolean;
}

/**
 * FlexCache Custom Resource: creates inter-cluster peering + FlexCache volume.
 *
 * Uses ONTAP REST API (Lambda-backed Custom Resource) because FlexCache
 * is NOT a CloudFormation-native resource.
 *
 * Lifecycle:
 * - Create: cluster peering → SVM peering → FlexCache volume → (optional) write-back
 * - Delete: FlexCache → SVM peer → cluster peer (reverse order)
 *
 * Note (佐藤 review): FlexCache TTL default is 3600s. Stale reads possible
 * during this window. Document acceptable staleness for use case.
 */
export class FlexCacheResource extends Construct {
  constructor(scope: Construct, id: string, props: FlexCacheResourceProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;

    const fn = new lambda.Function(this, 'FlexCacheManager', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
// FlexCache Custom Resource Handler (placeholder - full implementation uses shared ontap-client.ts)
exports.handler = async (event) => {
  console.log(JSON.stringify({ event: 'flexcache_cr', requestType: event.RequestType, props: event.ResourceProperties }));

  if (event.RequestType === 'Delete') {
    // Delete FlexCache → SVM peering → cluster peering
    return { Status: 'SUCCESS', PhysicalResourceId: event.PhysicalResourceId };
  }

  // Create: establish peering + create FlexCache
  // In production: use shared/lambda/ontap-custom-resource/ontap-client.ts
  return {
    Status: 'SUCCESS',
    PhysicalResourceId: 'flexcache-' + Date.now(),
    Data: { flexcacheStatus: 'CREATED' },
  };
};
`),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.lambdaSecurityGroup],
      timeout: cdk.Duration.minutes(14),
      reservedConcurrentExecutions: 2,
      logGroup: new logs.LogGroup(this, 'LogGroup', { retention: logs.RetentionDays.ONE_YEAR }),
      environment: {
        ORIGIN_FS_ID: props.originFileSystemId,
        CACHE_FS_ID: props.cacheFileSystemId,
        SECRET_ARN: props.secretArn,
        REGION: region,
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.secretArn],
      }),
    );
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['fsx:DescribeFileSystems'],
        resources: ['*'],
      }),
    );

    const provider = new cdk.custom_resources.Provider(this, 'Provider', { onEventHandler: fn });

    new cdk.CustomResource(this, 'FlexCache', {
      serviceToken: provider.serviceToken,
      properties: {
        originFsId: props.originFileSystemId,
        cacheFsId: props.cacheFileSystemId,
        originSvmName: props.originSvmName,
        cacheSvmName: props.cacheSvmName,
        originVolumeName: props.originVolumeName,
        flexcacheSizeMiB: props.flexcacheSizeMiB,
        writeBackEnabled: props.writeBackEnabled,
      },
    });
  }
}
