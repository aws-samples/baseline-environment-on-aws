import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BLEAFsxnDataAnalyticsStack } from '../lib/stack/blea-guest-fsxn-data-analytics-sample-stack';
import { devParameter } from '../parameter';

const app = new cdk.App();

// Parameter validation
const validThroughputs = [128, 256, 512, 1024, 2048, 4096];
if (!validThroughputs.includes(devParameter.fsxnThroughputCapacityMBps)) {
  throw new Error(
    `Invalid throughput capacity: ${devParameter.fsxnThroughputCapacityMBps} MBps. ` +
      `Must be one of: ${validThroughputs.join(', ')}`,
  );
}
if (devParameter.fsxnStorageCapacityGiB < 1024) {
  throw new Error(
    `Storage capacity must be >= 1024 GiB. Got: ${devParameter.fsxnStorageCapacityGiB}`,
  );
}

new BLEAFsxnDataAnalyticsStack(app, 'Dev-BLEAFsxnDataAnalytics', {
  description:
    'BLEA FSxN Data Analytics sample for guest accounts (tag:blea-guest-fsxn-data-analytics-sample)',
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },
  envName: devParameter.envName,
  monitoringNotifyEmail: devParameter.monitoringNotifyEmail,
  monitoringSlackWorkspaceId: devParameter.monitoringSlackWorkspaceId,
  monitoringSlackChannelId: devParameter.monitoringSlackChannelId,
  vpcCidr: devParameter.vpcCidr,
  fsxnStorageCapacityGiB: devParameter.fsxnStorageCapacityGiB,
  fsxnThroughputCapacityMBps: devParameter.fsxnThroughputCapacityMBps,
  fsxnDeploymentType: devParameter.fsxnDeploymentType,
  fsxnSvmName: devParameter.fsxnSvmName,
  fsxnVolumeName: devParameter.fsxnVolumeName,
  fsxnVolumeSizeMiB: devParameter.fsxnVolumeSizeMiB,
  fsxnJunctionPath: devParameter.fsxnJunctionPath,
  s3AccessPointName: devParameter.s3AccessPointName,
  s3ApFileSystemIdentityUser: devParameter.s3ApFileSystemIdentityUser,
  glueDatabaseName: devParameter.glueDatabaseName,
  glueCrawlerName: devParameter.glueCrawlerName,
  glueCrawlerSchedule: devParameter.glueCrawlerSchedule,
  athenaWorkgroupName: devParameter.athenaWorkgroupName,
});
