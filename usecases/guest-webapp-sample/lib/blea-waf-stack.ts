import * as cdk from '@aws-cdk/core';
import * as wafv2 from '@aws-cdk/aws-wafv2';

export interface BLEAWafStackProps extends cdk.StackProps {
  scope: string;
}

export class BLEAWafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: cdk.Construct, id: string, props: BLEAWafStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    //  WAFv2
    //  Note:
    //    For ALB, scope='REGIONAL' and you can deploy on the region you like.
    //    For CloudFront, scope='CLOUDFRONT' and you must specify props.env.region = 'us-east-1'
    //
    //  Caution:
    //
    //
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      defaultAction: { allow: {} },
      name: 'BLEAWebAcl',
      scope: props.scope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'BLEAWebAcl',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          priority: 1,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesCommonRuleSet',
          },
          name: 'AWSManagedRulesCommonRuleSet',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        },
        {
          priority: 2,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
          },
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
        },
        {
          priority: 3,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesAmazonIpReputationList',
          },
          name: 'AWSManagedRulesAmazonIpReputationList',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
        },
        {
          priority: 4,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesLinuxRuleSet',
          },
          name: 'AWSManagedRulesLinuxRuleSet',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesLinuxRuleSet',
            },
          },
        },
        {
          priority: 5,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWS-AWSManagedRulesSQLiRuleSet',
          },
          name: 'AWSManagedRulesSQLiRuleSet',
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
        },
      ],
    });
    this.webAcl = webAcl;

    // // ------------------------------------------------------------------------
    // // CloudFront Distrubution
    // //
    // const cfdistribution = new cloudfront.Distribution(this, 'Distribution', {
    //   defaultBehavior: {
    //     origin: new origins.LoadBalancerV2Origin(props.originAlb),
    //     viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //     allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
    //     cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
    //     originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
    //   },
    //   defaultRootObject: '/', // Need for SecurityHub Findings CloudFront.1 compliant

    //   domainNames: [fqdn],
    //   certificate: cloudfrontCert,
    //   additionalBehaviors: {
    //     '/static/*': {
    //       origin: new origins.S3Origin(props.originS3),
    //       viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //       cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    //     },
    //   },
    //   enableLogging: true,
    //   logBucket: props.logBucket,
    //   logIncludesCookies: true,
    //   logFilePrefix: 'CloudFrontAccessLogs/',
    //   errorResponses: [
    //     {
    //       httpStatus: 403,
    //       responseHttpStatus: 403,
    //       responsePagePath: '/static/sorry.html',
    //       ttl: cdk.Duration.seconds(20),
    //     },
    //   ],
    //   webAclId: webAcl.attrArn,
    // });

    // // Add A Record to Route 53
    // new r53.ARecord(this, 'appRecord', {
    //   recordName: props.hostName,
    //   zone: hostedZone,
    //   target: r53.RecordTarget.fromAlias(new r53targets.CloudFrontTarget(cfdistribution)),
    // });
  }
}
