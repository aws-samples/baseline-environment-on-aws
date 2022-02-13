import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_rds as rds } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';
import * as path from 'path';

export interface BLEALambdaPythonStackProps extends cdk.StackProps {
  alarmTopic: sns.Topic;
  myVpc: ec2.Vpc;
  vpcSubnets: ec2.SubnetSelection;
  dbUser: string;
  dbName: string;
  dbProxy: rds.DatabaseProxy;
  dbPort: string;
  dbSecurityGroup: ec2.SecurityGroup;
  appKey: kms.Key;
}
export class BLEALambdaPythonStack extends cdk.Stack {
  public readonly connectFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: BLEALambdaPythonStackProps) {
    super(scope, id, props);

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
              'aws:PrincipalArn': `arn:aws:iam::${cdk.Stack.of(this).account}:role/BLEA-LambdaPython-*`,
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

    // Using Lambda Python Library
    //
    // !!!! CAUTION !!!!
    // Lambda Python Library is experimental. This implementation might be changed.
    // See: https://docs.aws.amazon.com/cdk/api/latest/docs/aws-lambda-python-readme.html
    //

    // Lambda layer for Lambda Powertools
    // For install instruction, See: https://awslabs.github.io/aws-lambda-powertools-python/latest/#install
    const lambdaPowertools = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'lambda-powertools',
      `arn:aws:lambda:${cdk.Stack.of(this).region}:017000801446:layer:AWSLambdaPowertoolsPython:3`,
    );

    // Lambda Layer to install pg8000 library (pure-Python PostgreSQL driver)
    const lambdaLayer = new lambda.LayerVersion(this, 'LambdaLayer', {
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_8],
      code: lambda.AssetCode.fromAsset('./lambda/python/layer'),
    });

    // Connection Function
    const connectFunction = new lambda.Function(this, 'connection', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/python/function/connection')),
      handler: 'connection.lambda_handler',
      timeout: cdk.Duration.seconds(25),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      vpc: props.myVpc,
      vpcSubnets: props.vpcSubnets,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_98_0,
      layers: [lambdaPowertools, lambdaLayer],
      environment: {
        REGION: cdk.Stack.of(this).region,
        DB_USER: props.dbUser,
        DB_NAME: props.dbName,
        DB_ENDPOINT: props.dbProxy.endpoint,
        DB_PORT: props.dbPort,
      },
      environmentEncryption: props.appKey,
      logRetention: logs.RetentionDays.THREE_MONTHS,
    });

    connectFunction.addToRolePolicy(kmsPolicy);

    // Allow the function to connect to a RDS Proxy using IAM DB authentication
    // https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy-setup.html#rds-proxy-connecting
    // Need to extract DbiResourceID from RDS Proxy ARN
    // RDS Proxy ARN is like : "arn:aws:rds:{region}:{account_id}:{proxy_name}:{proxy_resource_id (=prx-xxxxxxxxxx)}"
    const resourceId = cdk.Fn.select(6, cdk.Fn.split(':', props.dbProxy.dbProxyArn));
    connectFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rds-db:connect'],
        resources: [
          `arn:aws:rds-db:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:dbuser:${resourceId}/${
            props.dbUser
          }`,
        ],
      }),
    );

    // Configure execution role to access resources in a VPC
    connectFunction.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
    );
    // Allow the function to establish a connection to RDS proxy
    connectFunction.connections.allowTo(props.dbSecurityGroup, ec2.Port.tcp(Number(props.dbPort)), 'to RDS Instance');
    this.connectFunction = connectFunction;

    // Sample metrics and alarm
    // See: https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/best-practices.html
    connectFunction
      .metricErrors({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'connectErrorsExecutionsAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    connectFunction
      .metricDuration({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'connectDurationAlarm', {
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
      statistic: cw.Statistic.MAXIMUM,
      dimensionsMap: {
        FunctionName: connectFunction.functionName,
      },
    })
      .createAlarm(this, 'connectConcurrentExecutionsAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    connectFunction
      .metricThrottles({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'connectThrottlesAlarm', {
        evaluationPeriods: 3,
        threshold: 80,
        datapointsToAlarm: 3,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
  }
}
