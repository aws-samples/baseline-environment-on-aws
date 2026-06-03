import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BLEAFsxnDataAnalyticsStack } from '../lib/stack/blea-guest-fsxn-data-analytics-sample-stack';
import { devParameter } from '../parameter';

test('Snapshot test', () => {
  const app = new cdk.App();
  const stack = new BLEAFsxnDataAnalyticsStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
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

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});
