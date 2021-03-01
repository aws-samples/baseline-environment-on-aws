import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import { Duration, Tags, RemovalPolicy, SecretValue } from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';


export interface ABLEEC2AppStackProps extends cdk.StackProps {
  myVpc: ec2.Vpc,
  environment: string,
  logBucket: s3.Bucket,
  appKey: kms.IKey,
}

export class ABLEEC2AppStack extends cdk.Stack {
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string, props: ABLEEC2AppStackProps) {
    super(scope, id, props);


    // --- Security Groups ---

    //Security Group of ALB for App
    const securityGroupForAlb = new ec2.SecurityGroup(this, 'SgAlb', {
      vpc: props.myVpc,
      allowAllOutbound: false,
    });
    securityGroupForAlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    securityGroupForAlb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

    //Security Group for Instance of App
    const securityGroupForApp = new ec2.SecurityGroup(this, 'SgApp', {
      vpc: props.myVpc,
      allowAllOutbound: false,
    });
    securityGroupForApp.addIngressRule(securityGroupForAlb, ec2.Port.tcp(80));
    securityGroupForApp.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());
    this.appServerSecurityGroup = securityGroupForApp;

    //Security Group for RDS
    // const securityGroupForRDS = new ec2.SecurityGroup(this, 'SgRds', {
    //   vpc: props.myVpc,
    //   allowAllOutbound: false,
    // });
    // securityGroupForRDS.addIngressRule(securityGroupForApp, ec2.Port.tcp(3306));
    // securityGroupForRDS.addEgressRule(securityGroupForApp, ec2.Port.allTcp());


    // ------------ Application LoadBalancer ---------------

    // S3 Bucket for ALB Logging (Needs SSE-S3)
    // https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    const albLogBucket = new s3.Bucket(this, 'AlbLogBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ALB for App Server
    const lbForApp = new elbv2.ApplicationLoadBalancer(this, 'AlbApp', {
      vpc: props.myVpc,
      internetFacing: true,
      securityGroup: securityGroupForAlb,
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Public'
      }),
    });
    Tags.of(lbForApp).add('Environment', props.environment);

    // Enable ALB Access Logging
    lbForApp.setAttribute("access_logs.s3.enabled", "true");
    lbForApp.setAttribute("access_logs.s3.bucket", albLogBucket.bucketName);
    
    // Permissions for Access Logging
    //    Why don't use bForApp.logAccessLogs(albLogBucket); ?
    //    Because logAccessLogs add wider permission to other account (PutObject*). S3 will become Noncompliant on Security Hub [S3.6]
    //    See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-s3-6
    //    See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    albLogBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      principals: [ new iam.AccountPrincipal('582318560864') ], // ALB Account for ap-northeast-1
      resources: [ albLogBucket.arnForObjects(`AWSLogs/${cdk.Stack.of(this).account}/*`) ],
    }));
    albLogBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      principals: [ new iam.ServicePrincipal('delivery.logs.amazonaws.com') ],
      resources: [ albLogBucket.arnForObjects(`AWSLogs/${cdk.Stack.of(this).account}/*`) ],
      conditions: {
        StringEquals: {
          "s3:x-amz-acl": "bucket-owner-full-control"
        }}}));
    albLogBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetBucketAcl'],
      principals: [ new iam.ServicePrincipal('delivery.logs.amazonaws.com') ],
      resources: [ albLogBucket.bucketArn ],
      }));


    // TargetGroup for App Server
    const tgForApp = new elbv2.ApplicationTargetGroup(this, 'TgApp', {
      vpc: props.myVpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        enabled: true,
        path: "/index.html"
      },
      deregistrationDelay: Duration.seconds(60),
    }); 
    Tags.of(tgForApp).add('Environment', props.environment);    


    // ALB Listener - TargetGroup 
    lbForApp.addListener('ListnerApp', {
      port: 80, 
      open: true,
      defaultTargetGroups: [tgForApp], 
    });


    // ------------ AppServers (AutoScaling) ---------------

    // InstanceProfile for AppServers
    const ssmInstanceRole = new iam.Role(this, 'ssm-instance-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      path: '/',
      managedPolicies: [
        { managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' },
        { managedPolicyArn: 'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy' },
      ],
    });

    // UserData for AppServer (setup httpd)
    const userDataForApp = ec2.UserData.forLinux({shebang: '#!/bin/bash'});
    userDataForApp.addCommands(
      "sudo yum -y install httpd",
      "sudo systemctl enable httpd",
      "sudo systemctl start httpd",
      "touch /var/www/html/index.html",
      "chown apache.apache /var/www/html/index.html",
    );

    const subnetAzs = props.myVpc.selectSubnets({
      subnetGroupName: 'Private'
    }).availabilityZones;
    const numAzs = subnetAzs.length;
    
    for (let i=0; i<2; i++) {
      const instance = new ec2.Instance(this, 'AppEc2'+i, {
        vpc: props.myVpc,
        availabilityZone:  subnetAzs[i%numAzs],
        vpcSubnets: props.myVpc.selectSubnets({
          subnetGroupName: 'Private'
        }),
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO
        ),
        machineImage: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
        }),
        securityGroup: securityGroupForApp,
        role: ssmInstanceRole, 
        userData: userDataForApp,
      });
      // Tags for AppServers
      Tags.of(instance).add('Environment', props.environment, {applyToLaunchedInstances: true,});
      Tags.of(instance).add('Name', 'AppServer'+i, {applyToLaunchedInstances: true,});
      Tags.of(instance).add('Role', 'FRA_AppServer', {applyToLaunchedInstances: true,});
      tgForApp.addTarget(new elbv2.InstanceTarget(instance.instanceId));
    } 
  }
}
