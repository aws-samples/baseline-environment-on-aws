import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_logs as cw_logs } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';

export interface BLEARestApiStackProps extends cdk.StackProps {
  alarmTopic: sns.Topic;
  connectFunction: lambda.Function;
}

export class BLEARestApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BLEARestApiStackProps) {
    super(scope, id, props);

    // Sample log group for API Gateway
    const apiGatewayLogGroup = new cw_logs.LogGroup(this, 'ApiGatewayLogGroup6', {
      retention: cw_logs.RetentionDays.ONE_MONTH,
    });

    // REST API
    //
    // Note: Enable Metrics, Logging(info level), Tracing(X-Ray),
    //       See: https://docs.aws.amazon.com/apigateway/latest/developerguide/rest-api-monitor.html
    //
    const restApi = new apigateway.RestApi(this, 'RestApi6', {
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
        statistic: cw.Statistic.AVERAGE,
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
    //
    const lists = restApi.root.addResource('connect');
    lists.addMethod('GET', new apigateway.LambdaIntegration(props.connectFunction));

    // const items = restApi.root.addResource('item');
    // items.addMethod('POST', new apigateway.LambdaIntegration(props.putItemFunction));

    // const titles = items.addResource('{title}');
    // titles.addMethod('GET', new apigateway.LambdaIntegration(props.getItemFunction));
  }
}
