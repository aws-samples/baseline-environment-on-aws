import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as sns from '@aws-cdk/aws-sns';
import * as kms from '@aws-cdk/aws-kms';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cw_actions from '@aws-cdk/aws-cloudwatch-actions';

export interface BLEADbDynamoDbStackProps extends cdk.StackProps {
  alarmTopic: sns.Topic;
  appKey: kms.Key;
}
export class BLEADbDynamoDbStack extends cdk.Stack {
  public readonly table: dynamodb.Table;
  constructor(scope: cdk.Construct, id: string, props: BLEADbDynamoDbStackProps) {
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
