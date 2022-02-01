import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';

export interface BLEADbDynamoDbStackProps extends cdk.StackProps {
  alarmTopic: sns.Topic;
  appKey: kms.Key;
}
export class BLEADbDynamoDbStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  constructor(scope: Construct, id: string, props: BLEADbDynamoDbStackProps) {
    super(scope, id, props);

    // Create table
    const table = new dynamodb.Table(this, 'DynamoDB', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'title',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'content',
        type: dynamodb.AttributeType.STRING,
      },
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.appKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create LSI
    table.addLocalSecondaryIndex({
      indexName: 'SampleIndex',
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Sample metrics and alarm
    table.metricSystemErrorsForOperations({
      period: cdk.Duration.minutes(5),
      statistic: cw.Statistic.AVERAGE,
      dimensionsMap: {
        Operation: 'GetItem',
      },
    });
    table
      .metricConsumedReadCapacityUnits({
        period: cdk.Duration.minutes(5),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'DynamoConsumedReadCapacityUnit', {
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        threshold: 90,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
    this.table = table;
  }
}
