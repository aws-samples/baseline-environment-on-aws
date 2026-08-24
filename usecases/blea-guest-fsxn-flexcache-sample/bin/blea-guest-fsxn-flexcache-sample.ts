import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BLEAFsxnFlexCacheStack } from '../lib/stack/blea-guest-fsxn-flexcache-sample-stack';
import { devParameter } from '../parameter';

const app = new cdk.App();

new BLEAFsxnFlexCacheStack(app, 'Dev-BLEAFsxnFlexCache', {
  description: 'BLEA FSxN FlexCache distributed access (tag:blea-guest-fsxn-flexcache-sample)',
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },
  envName: devParameter.envName,
  originVpcCidr: devParameter.originVpcCidr,
  cacheVpcCidr: devParameter.cacheVpcCidr,
  originFsxnStorageCapacityGiB: devParameter.originFsxnStorageCapacityGiB,
  originFsxnThroughputCapacityMBps: devParameter.originFsxnThroughputCapacityMBps,
  originVolumeName: devParameter.originVolumeName,
  originVolumeSizeMiB: devParameter.originVolumeSizeMiB,
  originJunctionPath: devParameter.originJunctionPath,
  cacheFsxnStorageCapacityGiB: devParameter.cacheFsxnStorageCapacityGiB,
  cacheFsxnThroughputCapacityMBps: devParameter.cacheFsxnThroughputCapacityMBps,
  cacheFsxnDeploymentType: devParameter.cacheFsxnDeploymentType,
  flexcacheSizeMiB: devParameter.flexcacheSizeMiB,
  flexcacheWriteBackEnabled: devParameter.flexcacheWriteBackEnabled,
  connectivityType: devParameter.connectivityType,
  ontapSecretArn: devParameter.ontapSecretArn,
});
