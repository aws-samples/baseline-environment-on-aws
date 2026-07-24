import * as cdk from 'aws-cdk-lib';
import {
  aws_ec2 as ec2,
  aws_events as events,
  aws_events_targets as targets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_sns as sns,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ServerlessOpsProps {
  vpc: ec2.IVpc;
  lambdaSecurityGroup: ec2.ISecurityGroup;
  fileSystemId: string;
  alarmTopic: sns.ITopic;
  maxCapacityGiB: number;
}

/**
 * Serverless Operations Automation: CapacityManager.
 *
 * Auto-expands FSxN storage when capacity exceeds threshold.
 * Guard: will NOT expand beyond maxCapacityGiB parameter.
 */
export class ServerlessOps extends Construct {
  public readonly capacityManagerFn: lambda.IFunction;

  constructor(scope: Construct, id: string, props: ServerlessOpsProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;

    // CapacityManager Lambda
    this.capacityManagerFn = new lambda.Function(this, 'CapacityManager', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { FSxClient, DescribeFileSystemsCommand, UpdateFileSystemCommand } = require('@aws-sdk/client-fsx');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

exports.handler = async (event) => {
  const fsId = process.env.FILE_SYSTEM_ID;
  const maxGiB = parseInt(process.env.MAX_CAPACITY_GIB);
  const topicArn = process.env.ALARM_TOPIC_ARN;
  const region = process.env.AWS_REGION;

  const fsx = new FSxClient({ region });
  const sns = new SNSClient({ region });

  // Get current capacity
  const descResp = await fsx.send(new DescribeFileSystemsCommand({ FileSystemIds: [fsId] }));
  const currentGiB = descResp.FileSystems[0].StorageCapacity;
  const newGiB = Math.min(currentGiB + 1024, maxGiB); // Add 1 TiB, cap at max

  console.log(JSON.stringify({
    event: 'capacity_check',
    fileSystemId: fsId,
    currentGiB,
    proposedGiB: newGiB,
    maxGiB,
  }));

  if (newGiB <= currentGiB) {
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: '[WARN] FSxN at max capacity - cannot auto-expand',
      Message: JSON.stringify({ fileSystemId: fsId, currentGiB, maxGiB, action: 'NONE - at max' }),
    }));
    return { status: 'AT_MAX', currentGiB };
  }

  // Expand storage
  await fsx.send(new UpdateFileSystemCommand({
    FileSystemId: fsId,
    StorageCapacity: newGiB,
  }));

  await sns.send(new PublishCommand({
    TopicArn: topicArn,
    Subject: '[INFO] FSxN storage auto-expanded',
    Message: JSON.stringify({ fileSystemId: fsId, previousGiB: currentGiB, newGiB, action: 'EXPANDED' }),
  }));

  console.log(JSON.stringify({ event: 'capacity_expanded', fileSystemId: fsId, previousGiB: currentGiB, newGiB }));
  return { status: 'EXPANDED', previousGiB: currentGiB, newGiB };
};
`),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(60),
      reservedConcurrentExecutions: 1,
      logGroup: new logs.LogGroup(this, 'CapacityManagerLogs', { retention: logs.RetentionDays.ONE_MONTH }),
      environment: {
        FILE_SYSTEM_ID: props.fileSystemId,
        MAX_CAPACITY_GIB: props.maxCapacityGiB.toString(),
        ALARM_TOPIC_ARN: props.alarmTopic.topicArn,
      },
    });

    // IAM: FSx UpdateFileSystem + Describe
    this.capacityManagerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['fsx:UpdateFileSystem', 'fsx:DescribeFileSystems'],
        resources: [`arn:aws:fsx:${region}:${cdk.Stack.of(this).account}:file-system/${props.fileSystemId}`],
      }),
    );
    props.alarmTopic.grantPublish(this.capacityManagerFn);
  }
}
