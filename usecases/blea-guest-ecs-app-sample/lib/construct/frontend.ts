import * as cdk from 'aws-cdk-lib';
import {
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_s3 as s3,
  aws_wafv2 as wafv2,
  // -- Sample to use custom domain on CloudFront
  // aws_certificatemanager as acm,
  // aws_route53 as r53,
  // aws_route53_targets as r53targets,
} from 'aws-cdk-lib';
import { ILoadBalancerV2 } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export interface FrontendProps {
  alb: ILoadBalancerV2;
  // -- Sample to use custom domain on CloudFront
  // hostedZoneId: string;
  // domainName: string;
  // cloudFrontHostName: string;
}

export class Frontend extends Construct {
  public readonly distributionId: string;
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);

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
      name: cdk.Names.uniqueResourceName(this, {}),
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: cdk.Names.uniqueResourceName(this, {}),
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

    // ------------ S3 Bucket for Web Contents ---------------
    // This bucket cannot be encrypted with KMS CMK
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/s3-website-cloudfront-error-403/
    //
    const webContentBucket = new s3.Bucket(this, 'WebContentBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // -- Sample to use custom domain on CloudFront
    // const hostedZone = r53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
    //   hostedZoneId: props.hostedZoneId,
    //   zoneName: props.domainName,
    // });

    // const cfCert = new acm.Certificate(this, 'CloudFrontCertificate', {
    //   domainName: `${props.cloudFrontHostName}.${props.domainName}`,
    //   validation: acm.CertificateValidation.fromDns(hostedZone),
    // });

    // --------- CloudFront Distrubution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(props.alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
      additionalBehaviors: {
        '/static/*': {
          origin: new origins.S3Origin(webContentBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: '/static/sorry.html',
          ttl: cdk.Duration.seconds(20),
        },
      ],
      defaultRootObject: '/', // Need for SecurityHub Findings CloudFront.1 compliant

      // WAF defined on us-east-1
      webAclId: webAcl.attrArn,

      // logging
      enableLogging: true,
      logBucket: new s3.Bucket(this, 'CloudFrontLogBucket', {
        accessControl: s3.BucketAccessControl.PRIVATE,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        enforceSSL: true,
        objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      }),
      logIncludesCookies: true,
      logFilePrefix: 'CloudFrontAccessLogs/',

      // -- Sample to use custom domain on CloudFront
      // domainNames: [`${props.cloudFrontHostName}.${hostedZone.zoneName}`],
      // certificate: cfCert,
    });
    this.distributionDomainName = distribution.distributionDomainName;
    this.distributionId = distribution.distributionId;

    // -- Sample to use custom domain on CloudFront
    // new r53.ARecord(this, 'CloudFrontARecord', {
    //   recordName: props.cloudFrontHostName,
    //   zone: hostedZone,
    //   target: r53.RecordTarget.fromAlias(new r53targets.CloudFrontTarget(distribution)),
    // });
  }
}
