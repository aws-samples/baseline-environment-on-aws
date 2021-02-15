import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import { Duration, Tags, RemovalPolicy, SecretValue } from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as ecs from '@aws-cdk/aws-ecs';

export interface BsAlbFargateStackProps extends cdk.StackProps {
  prodVpc: ec2.Vpc,
  environment: string,
  logBucket: s3.Bucket,
  appKey: kms.IKey,
}

export class BsAlbFargateStack extends cdk.Stack {
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string, props: BsAlbFargateStackProps) {
    super(scope, id, props);


    // --- Security Groups ---

    //Security Group of ALB for App
    const securityGroupForAlb = new ec2.SecurityGroup(this, 'security-group-for-alb', {
      vpc: props.prodVpc,
      allowAllOutbound: false,
    });
    securityGroupForAlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    securityGroupForAlb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

 

    // ------------ Application LoadBalancer ---------------

    // S3 Bucket for ALB Logging (Needs SSE-S3)
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    const albLogBucket = new s3.Bucket(this, 'alb-log-bucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL        
    });

    // ALB for App Server
    const lbForApp = new elbv2.ApplicationLoadBalancer(this, 'alb-for-app', {
      vpc: props.prodVpc,
      internetFacing: true,
      securityGroup: securityGroupForAlb,
      vpcSubnets: props.prodVpc.selectSubnets({
        subnetGroupName: 'ProdPublicSubnet'
      }),
    });
    lbForApp.logAccessLogs(albLogBucket);
    Tags.of(lbForApp).add('Environment', props.environment);

    // TargetGroup for App Server
    // const tgForApp = new elbv2.ApplicationTargetGroup(this, 'tg-for-app', {
    //   vpc: props.prodVpc,
    //   port: 80,
    //   protocol: elbv2.ApplicationProtocol.HTTP,
    //   targetType: elbv2.TargetType.INSTANCE,
    //   healthCheck: {
    //     enabled: true,
    //     path: "/index.html"
    //   },
    //   deregistrationDelay: Duration.seconds(60),
    // }); 
    // Tags.of(tgForApp).add('Environment', props.environment);    


    // ALB Listener - TargetGroup 
    // lbForApp.addListener('alb-listener-for-app', {
    //   port: 80, 
    //   open: true,
    //   defaultTargetGroups: [tgForApp], 
    // });

    // TargetGroup - AutoScalingGroup
//    fleetForApp.attachToApplicationTargetGroup(tgForApp);

    
    const cluster = new ecs.Cluster(this, 'BsCluster', { vpc: props.prodVpc });

    // Instantiate Fargate Service with just cluster and image
    new ecs_patterns.ApplicationLoadBalancedFargateService(this, "BsFargateService", {
      cluster,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      },
      taskSubnets: props.prodVpc.selectSubnets({
        subnetGroupName: 'ProdPrivateSubnet'
      })
    });      


  }
}
