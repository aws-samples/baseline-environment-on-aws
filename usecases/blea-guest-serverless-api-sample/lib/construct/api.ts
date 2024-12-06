import * as cdk from 'aws-cdk-lib';
import {
  aws_apigateway as apigateway,
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_logs as cw_logs,
  aws_sns as sns,
} from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { LambdaNodejs } from './lambda-nodejs';
import { LambdaPython } from './lambda-python';

interface ApiProps {
  alarmTopic: sns.ITopic;
  appKey: IKey;
  table: ITable;
}

export class Api extends Construct {
  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    // Sample log group for API Gateway
    const apiGatewayLogGroup = new cw_logs.LogGroup(this, 'ApiGatewayLogGroup', {
      retention: cw_logs.RetentionDays.ONE_MONTH,
    });

    // REST API
    //
    // Note: Enable Metrics, Logging(info level), Tracing(X-Ray),
    //       See: https://docs.aws.amazon.com/apigateway/latest/developerguide/rest-api-monitor.html
    //
    const restApi = new apigateway.RestApi(this, 'RestApi', {
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(apiGatewayLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        tracingEnabled: true, // Enable X-ray tracing
        metricsEnabled: true, // Enable Metrics for this method
        // cachingEnabled: true, // Please unncomment if you want to use cache
      },

      // CORS Prefilight Options sample
      // See: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html#cross-origin-resource-sharing-cors
      // defaultCorsPreflightOptions: {
      //   allowOrigins: apigateway.Cors.ALL_ORIGINS,
      //   allowMethods: apigateway.Cors.ALL_METHODS,
      //   allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
      // },
    });

    // Sample metrics as for API Gateway

    // Alarms for API Gateway
    // See: https://docs.aws.amazon.com/apigateway/latest/developerguide/monitoring-cloudwatch.html
    //
    restApi
      .metricCount({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'APIGatewayInvocationCount', {
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        threshold: 70,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Defining Lambda-backed APIs
    // See: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html#aws-lambda-backed-apis
    // Nodejs
    const nodejsFunc = new LambdaNodejs(this, 'LambdaNodejs', {
      alarmTopic: props.alarmTopic,
      appKey: props.appKey,
      table: props.table,
    });
    const nodejs = restApi.root.addResource('nodejs');
    const nodejsList = nodejs.addResource('list');
    nodejsList.addMethod('GET', new apigateway.LambdaIntegration(nodejsFunc.listItemsFunction));

    const nodejsItem = nodejs.addResource('item');
    nodejsItem.addMethod('POST', new apigateway.LambdaIntegration(nodejsFunc.putItemFunction));

    const nodejsTitle = nodejsItem.addResource('{title}');
    nodejsTitle.addMethod('GET', new apigateway.LambdaIntegration(nodejsFunc.getItemFunction));

    // Python
    const pythonFunc = new LambdaPython(this, 'LambdaPython', {
      alarmTopic: props.alarmTopic,
      appKey: props.appKey,
      table: props.table,
    });
    const python = restApi.root.addResource('python');
    const pythonList = python.addResource('list');
    pythonList.addMethod('GET', new apigateway.LambdaIntegration(pythonFunc.listItemsFunction));

    const pythonItem = python.addResource('item');
    pythonItem.addMethod('POST', new apigateway.LambdaIntegration(pythonFunc.putItemFunction));

    const pythonTitle = pythonItem.addResource('{title}');
    pythonTitle.addMethod('GET', new apigateway.LambdaIntegration(pythonFunc.getItemFunction));
  }
}
