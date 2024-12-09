import * as cdk from 'aws-cdk-lib';
import {
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_iam as iam,
  aws_s3 as s3,
  aws_sns as sns,
  aws_synthetics as synthetics,
} from 'aws-cdk-lib';
import { IAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface CanaryProps {
  alarmTopic: sns.ITopic;
  appEndpoint: string;
}

export class Canary extends Construct {
  public readonly canaryDurationAlarm: IAlarm;
  public readonly canaryFailedAlarm: IAlarm;

  constructor(scope: Construct, id: string, props: CanaryProps) {
    super(scope, id);

    // ----------------------------------------------------------------------------
    //   App Canary
    //

    // Create artifact bucket and apply some security settings.
    const canaryArtifactBucket = new s3.Bucket(this, `CanaryArtifactBucket`, {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    // Create canary

    // ToDo:
    //  We got error here on testing with Jest 28.x.x, so we downgrade jest to 27.x.x.
    //    "Cannot find module 'aws-cdk-lib/.warnings.jsii.js' from '../../node_modules/@aws-cdk/aws-synthetics-alpha/.warnings.jsii.js"
    //    See: https://github.com/aws/aws-cdk/issues/20622
    //  After fix this issue, we will upgrade Jest to 28.x.x.
    const canary = new synthetics.Canary(this, 'Canary', {
      schedule: synthetics.Schedule.rate(cdk.Duration.minutes(1)),
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset('lambda/canary-app'),
        handler: 'index.handler',
      }),
      // It's recommended that use the latest runtime version.
      // See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_Library.html
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_0,
      environmentVariables: {
        TARGETHOST: props.appEndpoint,
        TARGETPATH: '/',
      },
      artifactsBucketLocation: { bucket: canaryArtifactBucket },
    });

    // Fixed for UnauthorizedAttemptsAlarm
    // See: https://github.com/aws/aws-cdk/issues/13572
    canary.role.attachInlinePolicy(
      new iam.Policy(this, 'CanalyPolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetBucketLocation'],
            resources: [canary.artifactsBucket.bucketArn],
          }),
        ],
      }),
    );

    // Create duration alarm
    const canaryDurationAlarm = canary
      .metricDuration({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'CanaryDurationAlarm', {
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        threshold: 400,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      });
    canaryDurationAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
    this.canaryDurationAlarm = canaryDurationAlarm;

    // Create failed run alarm
    const canaryFailedAlarm = canary
      .metricFailed({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'CanaryFailedAlarm', {
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        threshold: 0.5,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
        treatMissingData: cw.TreatMissingData.NOT_BREACHING,
      });
    canaryFailedAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
    this.canaryFailedAlarm = canaryFailedAlarm;
  }
}
