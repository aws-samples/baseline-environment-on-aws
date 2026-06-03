import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BLEAFsxnDataAnalyticsStack } from '../lib/stack/blea-guest-fsxn-data-analytics-sample-stack';
import { devParameter } from '../parameter';

let template: Template;

beforeAll(() => {
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
  template = Template.fromStack(stack);
});

describe('FSxN File System', () => {
  test('is created with KMS encryption', () => {
    template.hasResourceProperties('AWS::FSx::FileSystem', {
      FileSystemType: 'ONTAP',
      KmsKeyId: Match.anyValue(),
    });
  });

  test('has correct deployment type from parameter', () => {
    template.hasResourceProperties('AWS::FSx::FileSystem', {
      OntapConfiguration: Match.objectLike({
        DeploymentType: 'SINGLE_AZ_1',
        ThroughputCapacity: 128,
      }),
    });
  });

  test('has storage efficiency enabled on volume', () => {
    template.hasResourceProperties('AWS::FSx::Volume', {
      OntapConfiguration: Match.objectLike({
        StorageEfficiencyEnabled: 'true',
      }),
    });
  });
});

describe('S3 Access Point', () => {
  test('is created with ONTAP type', () => {
    template.hasResourceProperties('AWS::FSx::S3AccessPointAttachment', {
      Type: 'ONTAP',
      Name: devParameter.s3AccessPointName,
    });
  });
});

describe('Networking', () => {
  test('has no NAT Gateway', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  test('has no Internet Gateway', () => {
    template.resourceCountIs('AWS::EC2::InternetGateway', 0);
  });

  test('has S3 VPC endpoint', () => {
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      ServiceName: Match.objectLike({
        'Fn::Join': Match.anyValue(),
      }),
    });
  });
});

describe('Data Analytics', () => {
  test('Glue Crawler targets S3 Access Point', () => {
    template.hasResourceProperties('AWS::Glue::Crawler', {
      DatabaseName: devParameter.glueDatabaseName,
      Targets: Match.objectLike({
        S3Targets: Match.anyValue(),
      }),
    });
  });

  test('Athena Workgroup enforces configuration', () => {
    template.hasResourceProperties('AWS::Athena::WorkGroup', {
      WorkGroupConfiguration: Match.objectLike({
        EnforceWorkGroupConfiguration: true,
      }),
    });
  });

  test('Query results bucket has block public access', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });
});

describe('Security', () => {
  test('Glue IAM role does not use wildcard glue permissions', () => {
    const roles = template.findResources('AWS::IAM::Policy');
    for (const [, role] of Object.entries(roles)) {
      const statements = role.Properties?.PolicyDocument?.Statement || [];
      for (const stmt of statements) {
        if (Array.isArray(stmt.Action)) {
          expect(stmt.Action).not.toContain('glue:*');
        } else {
          expect(stmt.Action).not.toBe('glue:*');
        }
      }
    }
  });
});

describe('Monitoring', () => {
  test('has CloudWatch alarms for FSxN', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
  });

  test('has SNS topic', () => {
    template.resourceCountIs('AWS::SNS::Topic', 1);
  });
});
