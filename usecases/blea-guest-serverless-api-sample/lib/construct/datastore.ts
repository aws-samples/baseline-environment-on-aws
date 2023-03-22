import * as cdk from 'aws-cdk-lib';
import {
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_dynamodb as dynamodb,
  aws_kms as kms,
  aws_sns as sns,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DatastoreProps {
  alarmTopic: sns.ITopic;
  appKey: kms.IKey;
}
export class Datastore extends Construct {
  public readonly table: dynamodb.Table;
  constructor(scope: Construct, id: string, props: DatastoreProps) {
    super(scope, id);

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
      statistic: cw.Stats.AVERAGE,
      dimensionsMap: {
        Operation: 'GetItem',
      },
    });
    table
      .metricConsumedReadCapacityUnits({
        period: cdk.Duration.minutes(5),
        statistic: cw.Stats.AVERAGE,
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
