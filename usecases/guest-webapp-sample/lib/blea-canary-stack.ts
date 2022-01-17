import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';
import * as s3 from '@aws-cdk/aws-s3';
import * as synthetics from '@aws-cdk/aws-synthetics';
import * as path from 'path';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cw_actions from '@aws-cdk/aws-cloudwatch-actions';

interface BLEACanaryStackProps extends cdk.StackProps {
  alarmTopic: sns.Topic;
  appEndpoint: string;
}

// !!! This is implemented by developer preview feature !!!
// CDK APIs might be changed
// - https://docs.aws.amazon.com/cdk/api/latest/docs/aws-synthetics-readme.html

export class BLEACanaryStack extends cdk.Stack {
  public readonly canaryDurationAlarm: cw.Alarm;
  public readonly canaryFailedAlarm: cw.Alarm;

  constructor(scope: cdk.Construct, id: string, props: BLEACanaryStackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------------------
    //   App Canary
    //

    // Create artifact bucket and apply some security settings.
    const canaryS3Bucket = new s3.Bucket(this, `canaryArtifact`, {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    // Create canary
    const appCanary = new synthetics.Canary(this, 'BLEACanaryApp', {
      schedule: synthetics.Schedule.rate(cdk.Duration.minutes(1)),
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(path.join(__dirname, '../lambda/canary-app')),
        handler: 'index.handler',
      }),
      // It's recommended that use the latest runtime version.
      // See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_Library.html
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_3,
      environmentVariables: {
        TARGETHOST: props.appEndpoint,
        TARGETPATH: '/',
      },
      artifactsBucketLocation: { bucket: canaryS3Bucket },
    });

    // Fixed for UnauthorizedAttemptsAlarm
    // See: https://github.com/aws/aws-cdk/issues/13572
    appCanary.role.attachInlinePolicy(
      new iam.Policy(this, 'appCanalyPolicyToS3', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetBucketLocation'],
            resources: [appCanary.artifactsBucket.bucketArn],
          }),
        ],
      }),
    );

    // Create duration alarm
    this.canaryDurationAlarm = appCanary
      .metricDuration({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'canaryDuration', {
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        threshold: 400,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      });
    this.canaryDurationAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Create failed run alarm
    this.canaryFailedAlarm = appCanary
      .metricFailed({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'canaryFailed', {
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        threshold: 0.5,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
        treatMissingData: cw.TreatMissingData.NOT_BREACHING,
      });
    this.canaryFailedAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
  }
}
