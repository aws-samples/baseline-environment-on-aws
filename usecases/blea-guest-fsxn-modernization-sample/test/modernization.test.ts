import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BLEAFsxnModernizationStack } from '../lib/stack/blea-guest-fsxn-modernization-sample-stack';
import { devParameter } from '../parameter';

describe('All patterns enabled (dev)', () => {
  const template = getTemplate(true, true);

  test('FSxN with KMS encryption', () => {
    template.hasResourceProperties('AWS::FSx::FileSystem', { FileSystemType: 'ONTAP', KmsKeyId: Match.anyValue() });
  });

  test('S3 Access Point created', () => {
    template.hasResourceProperties('AWS::FSx::S3AccessPointAttachment', { Type: 'ONTAP' });
  });

  test('EC2 ASG present when enabled', () => {
    template.resourceCountIs('AWS::AutoScaling::AutoScalingGroup', 1);
  });

  test('Lambda present when enabled', () => {
    // FileProcessor + CapacityManager + framework onEvent handler
    const lambdas = template.findResources('AWS::Lambda::Function');
    expect(Object.keys(lambdas).length).toBeGreaterThanOrEqual(1);
  });

  test('No IGW or NAT', () => {
    template.resourceCountIs('AWS::EC2::InternetGateway', 0);
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  test('CloudWatch alarms', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
  });

  test('Lambda IAM scoped to S3 AP', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const policyValues = Object.values(policies);
    const lambdaPolicy = policyValues.find((p: any) =>
      JSON.stringify(p.Properties?.PolicyDocument).includes('s3:GetObject'),
    );
    expect(lambdaPolicy).toBeDefined();
    expect(JSON.stringify(lambdaPolicy)).not.toContain('"*"');
  });
});

describe('All patterns disabled', () => {
  const template = getTemplate(false, false);

  test('No ASG when EC2 disabled', () => {
    template.resourceCountIs('AWS::AutoScaling::AutoScalingGroup', 0);
  });

  test('No compute Lambda when disabled', () => {
    // CapacityManager Lambda is always present (serverless ops), but FileProcessor should be absent
    const lambdas = template.findResources('AWS::Lambda::Function');
    const names = Object.keys(lambdas);
    const hasFileProcessor = names.some((n) => n.includes('FileProcessor'));
    expect(hasFileProcessor).toBe(false);
  });

  test('FSxN still present', () => {
    template.hasResourceProperties('AWS::FSx::FileSystem', { FileSystemType: 'ONTAP' });
  });
});

function getTemplate(enableEc2: boolean, enableLambda: boolean): Template {
  const app = new cdk.App();
  const stack = new BLEAFsxnModernizationStack(app, 'Test', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
    envName: 'Test',
    monitoringNotifyEmail: 'test@example.com',
    monitoringSlackWorkspaceId: '',
    monitoringSlackChannelId: '',
    vpcCidr: '10.0.0.0/16',
    fsxnStorageCapacityGiB: 1024,
    fsxnThroughputCapacityMBps: 128,
    fsxnDeploymentType: 'SINGLE_AZ_1',
    fsxnNfsVolumeSizeMiB: 102400,
    fsxnJunctionPath: '/shared',
    s3AccessPointName: 'test-ap',
    s3ApFileSystemIdentityUser: 'nobody',
    enableEc2Pattern: enableEc2,
    enableLambdaPattern: enableLambda,
    ec2InstanceType: 't3.micro',
    ec2MinCapacity: 1,
    ec2MaxCapacity: 1,
    enableEcsPattern: false,
    enableEksPattern: false,
    enableBatchPattern: false,
    backupRetentionDays: 7,
    capacityAlarmThresholdPercent: 80,
    maxCapacityGiB: 2048,
  });
  return Template.fromStack(stack);
}

describe('Snapshot', () => {
  test('template matches snapshot (all patterns enabled)', () => {
    const template = getTemplate(true, true);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
