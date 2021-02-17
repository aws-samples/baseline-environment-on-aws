import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as trail from '@aws-cdk/aws-cloudtrail';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cwl from '@aws-cdk/aws-logs';
import * as iam from '@aws-cdk/aws-iam';
import * as sns from '@aws-cdk/aws-sns';


interface metricFilterRule {
  namespace: string,
  name: string,
  pattern: string,
  alarm?: {
    topic: sns.Topic,
    comparisonOperator: cw.ComparisonOperator,
    evaluationPeriods: number,
    period: cdk.Duration,
    statistic: string,
    threshold: number,
    alarmDescription: string,
  }
}

interface GcTrailStackProps extends cdk.StackProps {
  notifyEmail: string
}


export class GcTrailStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: GcTrailStackProps) {
    super(scope, id, props);


    // CloudWatch Logs Group for CloudTrail
    const cloudTrailLogGroup = new cwl.LogGroup(this, 'CloudTrailLogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS
    });

    //Create S3 bucket for ALB access Logs
    // const loggingBucket = new s3.Bucket(this, 'AlbLogsBucket', {
    //   accessControl: s3.BucketAccessControl.PRIVATE,
    // });

    // Archive Bucket for CloudTrail
    const archiveLogsBucket = new s3.Bucket(this, 'ArchiveLogsBucket', {
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [ 
        {
          enabled: true,
          expiration: cdk.Duration.days(2555),
          transitions: [
            {
              transitionAfter: cdk.Duration.days(90),
              storageClass: s3.StorageClass.GLACIER
            }
          ]
        }
      ]
    });
    this.addBaseBucketPolicy(archiveLogsBucket);

    // Bucket for CloudTrail
    const cloudTrailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      versioned: true,
      serverAccessLogsBucket: archiveLogsBucket,
      serverAccessLogsPrefix: "cloudtraillogs",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.addBaseBucketPolicy(cloudTrailBucket);

    // CloudTrail
    const cloudTrailLoggingLocal = new trail.Trail(this, 'CloudTrail', {
      bucket: cloudTrailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      cloudWatchLogGroup: cloudTrailLogGroup,
      sendToCloudWatchLogs: true
    });

    // -----------

    // EC2 Role for Manage CloudTrail Logs
    const cloudTrailRole = new iam.Role(this, 'CloudTrailRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });
    cloudTrailBucket.grantPut(cloudTrailRole);
    cloudTrailBucket.grantRead(cloudTrailRole);

    // SNS Topic
    const securityAlarmTopic = new sns.Topic(this, 'SecurityAlarmTopic');
    new sns.Subscription(this, 'securityAlarmEmail', {
      endpoint: props.notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: securityAlarmTopic
    });


    // Add Metric Filter Rules
    const metrifFilterRules: metricFilterRule[] = [
      {
        namespace:  'CloudTrailMetrics',
        name:       'IAMPolicyEventCount',
        pattern:    '{($.eventName=DeleteGroupPolicy)||($.eventName=DeleteRolePolicy)||($.eventName=DeleteUserPolicy)||($.eventName=PutGroupPolicy)||($.eventName=PutRolePolicy)||($.eventName=PutUserPolicy)||($.eventName=CreatePolicy)||($.eventName=DeletePolicy)||($.eventName=CreatePolicyVersion)||($.eventName=DeletePolicyVersion)||($.eventName=AttachRolePolicy)||($.eventName=DetachRolePolicy)||($.eventName=AttachUserPolicy)||($.eventName=DetachUserPolicy)||($.eventName=AttachGroupPolicy)||($.eventName=DetachGroupPolicy)}',
        alarm: {
          topic: securityAlarmTopic,
          comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 1,
          period: cdk.Duration.seconds(300),
          statistic: 'Sum',
          threshold: 1,
          alarmDescription: 'Alarms when an API call is made to create, update or delete a Network ACL.',
        }      
      },
      {
        namespace:  'CloudTrailMetrics',
        name:       'NetworkAclEventCount',
        pattern:    '{ ($.eventName = CreateNetworkAcl) || ($.eventName = CreateNetworkAclEntry) || ($.eventName = DeleteNetworkAcl) || ($.eventName = DeleteNetworkAclEntry) || ($.eventName = ReplaceNetworkAclEntry) || ($.eventName = ReplaceNetworkAclAssociation) }',
        alarm: {
          topic: securityAlarmTopic,
          comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 1,
          period: cdk.Duration.seconds(300),
          statistic: 'Sum',
          threshold: 1,
          alarmDescription: 'Alarms when an API call is made to create, update or delete a Network ACL.',
        }      
      },
      {
        namespace:  'CloudTrailMetrics',
        name:       'SecurityGroupEventCount',
        pattern:    '{ ($.eventName = AuthorizeSecurityGroupIngress) || ($.eventName = AuthorizeSecurityGroupEgress) || ($.eventName = RevokeSecurityGroupIngress) || ($.eventName = RevokeSecurityGroupEgress) || ($.eventName = CreateSecurityGroup) || ($.eventName = DeleteSecurityGroup) }',
        alarm: {
          topic: securityAlarmTopic,
          comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 1,
          period: cdk.Duration.seconds(300),
          statistic: 'Sum',
          threshold: 1,
          alarmDescription: 'Alarms when an API call is made to create, update or delete a Security Group.',
        }      
      },
      {
        namespace:  'CloudTrailMetrics',
        name:       'RootUserPolicyEventCount',
        pattern:    '{ $.userIdentity.type = "Root" && $.userIdentity.invokedBy NOT EXISTS && $.eventType != "AwsServiceEvent" }',
        alarm: {
          topic: securityAlarmTopic,
          comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 1,
          period: cdk.Duration.seconds(300),
          statistic: 'Sum',
          threshold: 1,
          alarmDescription: 'Root user activity detected!',
        }      
      },
      {
        namespace:  'CloudTrailMetrics',
        name:       'UnauthorizedAttemptCount',
        pattern:    '{($.errorCode=AccessDenied)||($.errorCode=UnauthorizedOperation)}',
        alarm: {
          topic: securityAlarmTopic,
          comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 1,
          period: cdk.Duration.seconds(300),
          statistic: 'Sum',
          threshold: 5,
          alarmDescription: 'Multiple unauthorized actions or logins attempted!',
        }      
      },
      {
        namespace:  'CloudTrailMetrics',
        name:       'NewAccessKeyCreated',
        pattern:    '{($.eventName=CreateAccessKey)}',
        alarm: {
          topic: securityAlarmTopic,
          comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 1,
          period: cdk.Duration.seconds(300),
          statistic: 'Sum',
          threshold: 1,
          alarmDescription: 'Multiple unauthorized actions or logins attempted!',
        }      
      },
      {
        namespace:  'CloudTrailMetrics',
        name:       'CloudTrailChangeCount',
        pattern:    '{($.eventSource = cloudtrail.amazonaws.com) && (($.eventName != Describe*) && ($.eventName != Get*) && ($.eventName != Lookup*) && ($.eventName != Lookup*))}',
        alarm: {
          topic: securityAlarmTopic,
          comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 1,
          period: cdk.Duration.seconds(300),
          statistic: 'Sum',
          threshold: 1,
          alarmDescription: 'Warning: Changes to CloudTrail log configuration detected in this account',
        }      
      },
    ]


    // Create metric filters and Alarms if needs it.
    metrifFilterRules.forEach(rule => {
      const mf = new cwl.MetricFilter(this, rule.name, {
        logGroup: cloudTrailLogGroup,
        filterPattern: {
          logPatternString: rule.pattern
        },
        metricNamespace: rule.namespace,
        metricName: rule.name,
      });

      if (rule.alarm) {
        new cw.Alarm(this, rule.name+'Alarm', {
          metric: mf.metric({ 
            statistic:        rule.alarm.statistic,
            period:           rule.alarm.period
          }),
          evaluationPeriods:  rule.alarm.evaluationPeriods,
          threshold:          rule.alarm.threshold,
          comparisonOperator: rule.alarm.comparisonOperator,
          alarmDescription:   rule.alarm.alarmDescription,
        });
      }
    });


  }


  // Add base BucketPolicy for CloudTrail
  addBaseBucketPolicy(bucket: s3.Bucket) :void {
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'Enforce HTTPS Connections',
      effect: iam.Effect.DENY,
      actions: ['s3:*'],
      principals: [ new iam.AnyPrincipal() ],
      resources: [ bucket.arnForObjects('*') ],
      conditions: {
        'Bool': {
          'aws:SecureTransport': false
        }
      }
    }));

    bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'Restrict Delete* Actions',
      effect: iam.Effect.DENY,
      actions: ['s3:Delete*'],
      principals: [ new iam.AnyPrincipal() ],
      resources: [ bucket.arnForObjects('*') ]      
    }));

    bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'DenyUnEncryptedObjectUploads',
      effect: iam.Effect.DENY,
      actions: ['s3:PutObject'],
      principals: [ new iam.AnyPrincipal() ],
      resources: [ bucket.arnForObjects('*') ],
      conditions:  {
        'StringNotEquals': {
          's3:x-amz-server-side-encryption': 'AES256'
        }
      }
    }));
   
  }

}
