import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import { Duration, Tags, RemovalPolicy, SecretValue } from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as ecs from '@aws-cdk/aws-ecs';
import * as wafv2 from "@aws-cdk/aws-wafv2";

export interface GcAlbFargateStackProps extends cdk.StackProps {
  prodVpc: ec2.Vpc,
  environment: string,
  logBucket: s3.Bucket,
  appKey: kms.IKey,
}

export class GcAlbFargateStack extends cdk.Stack {
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string, props: GcAlbFargateStackProps) {
    super(scope, id, props);


    // --- Security Groups ---

    //Security Group of ALB for App
    const securityGroupForAlb = new ec2.SecurityGroup(this, 'SgAlb', {
      vpc: props.prodVpc,
      allowAllOutbound: false,
    });
    securityGroupForAlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    securityGroupForAlb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

 
   // ------------ S3 Bucket for Web Contents ---------------

   const webContentBucket = new s3.Bucket(this, 'WebBucket', {
    accessControl: s3.BucketAccessControl.PRIVATE,
    lifecycleRules: [{
      enabled: true,
      expiration: Duration.days(2555),
      transitions: [{
        storageClass: s3.StorageClass.GLACIER,
        transitionAfter: Duration.days(90),
      }],
    }],
    removalPolicy: RemovalPolicy.DESTROY,
    versioned: false,
    encryptionKey: props.appKey,
    encryption: s3.BucketEncryption.KMS
  });

  // Prevent access without SSL
  webContentBucket.addToResourcePolicy(new iam.PolicyStatement({
    effect:     iam.Effect.DENY,
    principals: [ new iam.AnyPrincipal() ],
    actions:    [ 's3:*' ],
    resources:  [ webContentBucket.bucketArn ],
    conditions: {
      'Bool' : {
        'aws:SecureTransport': 'false'
      }}
  }));

  // Prevent putting data without encryption
  webContentBucket.addToResourcePolicy(new iam.PolicyStatement({
    effect:     iam.Effect.DENY,
    principals: [ new iam.AnyPrincipal() ],
    actions:    [ 's3:PutObject' ],
    resources:  [ webContentBucket.arnForObjects('*') ],
    conditions: {
      "StringNotEquals": {
        "s3:x-amz-server-side-encryption": "AES256"
      }}
  }));


    // ------------ Application LoadBalancer ---------------

    // S3 Bucket for ALB Logging (Needs SSE-S3)
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    const albLogBucket = new s3.Bucket(this, 'alb-log-bucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL        
    });

    // ALB for App Server
    const lbForApp = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.prodVpc,
      internetFacing: true,
      securityGroup: securityGroupForAlb,
      vpcSubnets: props.prodVpc.selectSubnets({
        subnetGroupName: 'Public'
      }),
    });
    lbForApp.logAccessLogs(albLogBucket);
    Tags.of(lbForApp).add('Environment', props.environment);

    

    const cluster = new ecs.Cluster(this, 'BsCluster', { vpc: props.prodVpc });

    // Instantiate Fargate Service with just cluster and image
    new ecs_patterns.ApplicationLoadBalancedFargateService(this, "AlbFargate", {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      },
      taskSubnets: props.prodVpc.selectSubnets({
        subnetGroupName: 'Private'
      }),
      loadBalancer: lbForApp
    });      

    // WAFv2 for ALB
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      defaultAction: { allow: {}},
      name: "GcWebAcl",
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "GcWebAcl",
        sampledRequestsEnabled: true
      },
      rules: [
        {
          priority: 1,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesCommonRuleSet"
          },
          name: "AWSManagedRulesCommonRuleSet",
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet"
            }
          }
        },
        {
          priority: 2,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesKnownBadInputsRuleSet"
          },
          name: "AWSManagedRulesKnownBadInputsRuleSet",
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet"
            }
          }
        },
        {
          priority: 3,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesAmazonIpReputationList"
          },
          name: "AWSManagedRulesAmazonIpReputationList",
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesAmazonIpReputationList"
            }
          }
        },
        {
          priority: 4,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesLinuxRuleSet"
          },
          name: "AWSManagedRulesLinuxRuleSet",
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesLinuxRuleSet"
            }
          }
        },
        {
          priority: 5,
          overrideAction: { count: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesSQLiRuleSet"
          },
          name: "AWSManagedRulesSQLiRuleSet",
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesSQLiRuleSet"
            }
          }
        },        
      ],
    });

    new wafv2.CfnWebACLAssociation(this, 'BsWebAclAssociation', {
      resourceArn: lbForApp.loadBalancerArn,
      webAclArn: webAcl.attrArn
    })


  }
}
