import * as cdk from 'aws-cdk-lib';
import {
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_kms as kms,
  aws_lambda as lambda,
  aws_lambda_nodejs as node_lambda,
  aws_logs as logs,
  aws_sns as sns,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface LambdaNodejsProps {
  alarmTopic: sns.ITopic;
  table: dynamodb.ITable;
  appKey: kms.IKey;
}

export class LambdaNodejs extends Construct {
  public readonly getItemFunction: lambda.Function;
  public readonly listItemsFunction: lambda.Function;
  public readonly putItemFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaNodejsProps) {
    super(scope, id);

    // Custom Policy for App Key
    props.appKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:*'],
        principals: [new iam.AccountRootPrincipal()],
        resources: ['*'],
      }),
    );
    props.appKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [
          new iam.AnyPrincipal().withConditions({
            ArnLike: {
              'aws:PrincipalArn': `arn:aws:iam::${cdk.Stack.of(this).account}:role/BLEA-LambdaNodejs-*`,
            },
          }),
        ],
        resources: ['*'],
      }),
    );

    // Policy operating KMS CMK for Lambda
    const kmsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
      resources: [props.appKey.keyArn],
    });

    // Using Lambda Node.js Library
    // See: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-nodejs-readme.html

    // GetItem Function
    const getItemFunction = new node_lambda.NodejsFunction(this, 'GetItemFunction', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      entry: 'lambda/nodejs/getItem.js',
      handler: 'getItem',
      memorySize: 256,
      timeout: cdk.Duration.seconds(25),
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
      environment: {
        DDB_TABLE: props.table.tableName,
      },
      environmentEncryption: props.appKey,
      logRetention: logs.RetentionDays.THREE_MONTHS,
    });
    getItemFunction.addToRolePolicy(kmsPolicy);
    getItemFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:GetItem'],
        resources: [props.table.tableArn, props.table.tableArn + '/index/*'],
      }),
    );
    this.getItemFunction = getItemFunction;

    // Sample metrics and alarm
    // See: https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/best-practices.html
    getItemFunction
      .metricErrors({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'getItemErrorsAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    getItemFunction
      .metricDuration({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'getItemDurationAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    new cw.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'ConcurrentExecutions',
      period: cdk.Duration.minutes(5),
      statistic: cw.Stats.MAXIMUM,
      dimensionsMap: {
        FunctionName: getItemFunction.functionName,
      },
    })
      .createAlarm(this, 'getItemConcurrentExecutionsAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    getItemFunction
      .metricThrottles({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'getItemThrottlesAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // ListItem Function
    const listItemsFunction = new node_lambda.NodejsFunction(this, 'ListItemsFunction', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      entry: 'lambda/nodejs/listItems.js',
      handler: 'listItems',
      timeout: cdk.Duration.seconds(25),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
      environment: {
        DDB_TABLE: props.table.tableName,
      },
      environmentEncryption: props.appKey,
      logRetention: logs.RetentionDays.THREE_MONTHS,
    });
    listItemsFunction.addToRolePolicy(kmsPolicy);
    listItemsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Query', 'dynamodb:Scan'],
        resources: [props.table.tableArn, props.table.tableArn + '/index/*'],
      }),
    );
    this.listItemsFunction = listItemsFunction;

    // Sample metrics and alarm
    // See: https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/best-practices.html
    listItemsFunction
      .metricErrors({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'listItemsErrorsExecutionsAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    listItemsFunction
      .metricDuration({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'listItemsDurationAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    new cw.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'ConcurrentExecutions',
      period: cdk.Duration.minutes(5),
      statistic: cw.Stats.MAXIMUM,
      dimensionsMap: {
        FunctionName: listItemsFunction.functionName,
      },
    })
      .createAlarm(this, 'listItemsConcurrentExecutionsAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
    listItemsFunction
      .metricThrottles({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'listItemsThrottlesAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // PutItem Function
    const putItemFunction = new node_lambda.NodejsFunction(this, 'PutItemFunction', {
      runtime: lambda.Runtime.NODEJS_LATEST,
      entry: 'lambda/nodejs/putItem.js',
      handler: 'putItem',
      timeout: cdk.Duration.seconds(25),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
      environment: {
        DDB_TABLE: props.table.tableName,
      },
      environmentEncryption: props.appKey,
      logRetention: logs.RetentionDays.THREE_MONTHS,
    });
    putItemFunction.addToRolePolicy(kmsPolicy);
    putItemFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem'],
        resources: [props.table.tableArn, props.table.tableArn + '/index/*'],
      }),
    );
    this.putItemFunction = putItemFunction;

    // Sample metrics and alarm
    // See: https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/best-practices.html
    putItemFunction
      .metricErrors({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'putItemErrorsAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    putItemFunction
      .metricDuration({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'putItemDurationAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    new cw.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'ConcurrentExecutions',
      period: cdk.Duration.minutes(5),
      statistic: cw.Stats.MAXIMUM,
      dimensionsMap: {
        FunctionName: putItemFunction.functionName,
      },
    })
      .createAlarm(this, 'putItemConcurrentExecutionsAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    putItemFunction
      .metricThrottles({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'putItemThrottlesAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
  }
}
