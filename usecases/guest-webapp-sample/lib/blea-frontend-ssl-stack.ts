import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { region_info as ri } from 'aws-cdk-lib';
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib';
import { aws_cloudfront_origins as origins } from 'aws-cdk-lib';
import { aws_route53 as r53 } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import { aws_route53_targets as r53targets } from 'aws-cdk-lib';
import { IBLEAFrontend } from './blea-frontend-interface';

interface BLEAFrontendSslStackProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  hostedZoneId: string;
  domainName: string;
  hostName: string;
  webAcl: wafv2.CfnWebACL;
}

export class BLEAFrontendSslStack extends cdk.Stack implements IBLEAFrontend {
  public readonly appAlb: elbv2.ApplicationLoadBalancer;
  public readonly appAlbListerner: elbv2.ApplicationListener;
  public readonly appAlbSecurityGroup: ec2.SecurityGroup;
  public readonly webContentsBucket: s3.Bucket;
  public readonly cfDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: BLEAFrontendSslStackProps) {
    super(scope, id, props);

    const appHostedZone = r53.HostedZone.fromHostedZoneAttributes(this, 'appHostedZone', {
      zoneName: props.domainName,
      hostedZoneId: props.hostedZoneId,
    });

    // ------------------------------------------------------------------------
    // Certificates
    //
    // Note:  CloudFront and ALB need certificate with the same FQDN

    // for cloudfront (us-east-1 Cert)
    const cloudfrontCert = new acm.DnsValidatedCertificate(this, 'cfCertificate', {
      domainName: [props.hostName, props.domainName].join('.'),
      hostedZone: appHostedZone,
      region: 'us-east-1',
    });

    // for ELB (Local regional Cert)
    const albCert = new acm.DnsValidatedCertificate(this, 'apiCertificate', {
      domainName: [props.hostName, props.domainName].join('.'),
      hostedZone: appHostedZone,
      region: cdk.Stack.of(this).region,
    });

    // --- Security Groups ---

    //Security Group of ALB for App
    const securityGroupForAlb = new ec2.SecurityGroup(this, 'SgAlb', {
      vpc: props.myVpc,
      allowAllOutbound: true,
    });
    this.appAlbSecurityGroup = securityGroupForAlb;

    // ------------ S3 Bucket for Web Contents ---------------
    // This bucket cannot be encrypted with KMS CMK
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/s3-website-cloudfront-error-403/
    //
    const webContentBucket = new s3.Bucket(this, 'WebBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });
    this.webContentsBucket = webContentBucket;

    // ------------ Application LoadBalancer ---------------

    // ALB for App Server
    const lbForApp = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.myVpc,
      internetFacing: true,
      securityGroup: securityGroupForAlb,
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Public',
      }),
    });
    this.appAlb = lbForApp;

    const lbForAppListener = lbForApp.addListener('https', {
      port: 443,
      certificates: [
        {
          certificateArn: albCert.certificateArn,
        },
      ],
      sslPolicy: elbv2.SslPolicy.TLS12_EXT,
    });
    this.appAlbListerner = lbForAppListener;

    // Enabled WAF for ALB
    new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: lbForApp.loadBalancerArn,
      webAclArn: props.webAcl.attrArn,
    });

    // Enable ALB Access Logging
    //
    // This bucket can not be encrypted with KMS CMK
    // See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    //
    const albLogBucket = new s3.Bucket(this, 'alb-log-bucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    lbForApp.setAttribute('access_logs.s3.enabled', 'true');
    lbForApp.setAttribute('access_logs.s3.bucket', albLogBucket.bucketName);

    // Permissions for Access Logging
    //    Why don't use bForApp.logAccessLogs(albLogBucket); ?
    //    Because logAccessLogs add wider permission to other account (PutObject*). S3 will become Noncompliant on Security Hub [S3.6]
    //    See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-s3-6
    //    See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions

    // Quick hack for test:
    //  cdk.process.env.* and cdk.Stack.of(this).* returns undefined / ${Token[Region.4]} respectively at test time.
    //  RegionInfo.get(region) returns error when it passed illegal value.
    //  So we add quick hack to pass 'ap-northeast-1' when region value is illegal.
    const region = cdk.Stack.of(this).region.startsWith('${Token') ? 'ap-northeast-1' : cdk.Stack.of(this).region;

    albLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject'],
        // ALB access logging needs S3 put permission from ALB service account for the region
        principals: [new iam.AccountPrincipal(ri.RegionInfo.get(region).elbv2Account)],
        resources: [albLogBucket.arnForObjects(`AWSLogs/${cdk.Stack.of(this).account}/*`)],
      }),
    );
    albLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject'],
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        resources: [albLogBucket.arnForObjects(`AWSLogs/${cdk.Stack.of(this).account}/*`)],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
      }),
    );
    albLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetBucketAcl'],
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        resources: [albLogBucket.bucketArn],
      }),
    );

    // --------- CloudFront Distrubution
    const cfDistribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(lbForApp, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
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

      // Domain and SSL Certificate
      domainNames: [[props.hostName, props.domainName].join('.')],
      certificate: cloudfrontCert,

      // WAF defined on us-east-1
      // webAclId: props.webAcl.attrArn,

      // logging
      enableLogging: true,
      logBucket: new s3.Bucket(this, 'CloudFrontLogBucket', {
        accessControl: s3.BucketAccessControl.PRIVATE,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        enforceSSL: true,
      }),
      logIncludesCookies: true,
      logFilePrefix: 'CloudFrontAccessLogs/',
    });
    this.cfDistribution = cfDistribution;

    // Add A Record to Route 53
    new r53.ARecord(this, 'sampleApp', {
      recordName: props.hostName,
      zone: appHostedZone,
      target: r53.RecordTarget.fromAlias(new r53targets.CloudFrontTarget(cfDistribution)),
    });
  }
}
