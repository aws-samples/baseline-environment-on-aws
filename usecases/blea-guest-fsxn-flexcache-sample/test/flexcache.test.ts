import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BLEAFsxnFlexCacheStack } from '../lib/stack/blea-guest-fsxn-flexcache-sample-stack';

let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new BLEAFsxnFlexCacheStack(app, 'Test', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
    envName: 'Test',
    originVpcCidr: '10.0.0.0/16',
    cacheVpcCidr: '10.1.0.0/16',
    originFsxnStorageCapacityGiB: 1024,
    originFsxnThroughputCapacityMBps: 128,
    originVolumeName: 'vol_source',
    originVolumeSizeMiB: 102400,
    originJunctionPath: '/data',
    cacheFsxnStorageCapacityGiB: 1024,
    cacheFsxnThroughputCapacityMBps: 128,
    cacheFsxnDeploymentType: 'SINGLE_AZ_1',
    flexcacheSizeMiB: 51200,
    flexcacheWriteBackEnabled: false,
    connectivityType: 'VPC_PEERING',
    ontapSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:test-XXXXXX',
  });
  template = Template.fromStack(stack);
});

describe('Dual FSxN Architecture', () => {
  test('creates 2 FSxN file systems (origin + cache)', () => {
    template.resourceCountIs('AWS::FSx::FileSystem', 2);
  });

  test('origin is Multi-AZ', () => {
    const fsList = template.findResources('AWS::FSx::FileSystem');
    const originFs = Object.values(fsList).find(
      (r: any) => r.Properties.OntapConfiguration.DeploymentType === 'MULTI_AZ_1',
    );
    expect(originFs).toBeDefined();
  });

  test('cache is Single-AZ (no RouteTableIds)', () => {
    const fsList = template.findResources('AWS::FSx::FileSystem');
    const cacheFs = Object.values(fsList).find(
      (r: any) => r.Properties.OntapConfiguration.DeploymentType === 'SINGLE_AZ_1',
    );
    expect(cacheFs).toBeDefined();
    expect((cacheFs as any).Properties.OntapConfiguration.RouteTableIds).toBeUndefined();
  });

  test('creates 2 SVMs (origin + cache)', () => {
    template.resourceCountIs('AWS::FSx::StorageVirtualMachine', 2);
  });
});

describe('Connectivity', () => {
  test('creates VPC Peering connection', () => {
    template.resourceCountIs('AWS::EC2::VPCPeeringConnection', 1);
  });

  test('creates routes in both VPCs (4 total: 2 subnets × 2 directions)', () => {
    template.resourceCountIs('AWS::EC2::Route', 4);
  });
});

describe('Security', () => {
  test('inter-cluster ports (11104, 11105) in security groups', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.arrayWith([Match.objectLike({ FromPort: 11104, ToPort: 11104 })]),
    });
  });

  test('no Internet Gateway', () => {
    template.resourceCountIs('AWS::EC2::InternetGateway', 0);
  });

  test('no NAT Gateway', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  test('KMS encryption', () => {
    template.hasResourceProperties('AWS::KMS::Key', { EnableKeyRotation: true });
  });
});

describe('FlexCache Custom Resource', () => {
  test('creates FlexCache custom resource', () => {
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
  });

  test('Lambda has VPC configuration', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      VpcConfig: Match.anyValue(),
    });
  });
});

describe('Snapshot', () => {
  test('template matches snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});
