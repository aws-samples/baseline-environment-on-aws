import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import { Duration, Tags, RemovalPolicy, SecretValue } from '@aws-cdk/core';
import * as kms from '@aws-cdk/aws-kms';


export interface GcEc2appSimpleStackProps extends cdk.StackProps {
  prodVpc: ec2.Vpc,
  environment: string,
  logBucket: s3.Bucket,
  appKey: kms.IKey,
}

export class GcEc2appSimpleStack extends cdk.Stack {
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: cdk.Construct, id: string, props: GcEc2appSimpleStackProps) {
    super(scope, id, props);


    // --- Security Groups ---

    //Security Group of ALB for App
    const securityGroupForAlb = new ec2.SecurityGroup(this, 'SgAlb', {
      vpc: props.prodVpc,
      allowAllOutbound: false,
    });
    securityGroupForAlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
    securityGroupForAlb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

    //Security Group for Instance of App
    const securityGroupForApp = new ec2.SecurityGroup(this, 'SgApp', {
      vpc: props.prodVpc,
      allowAllOutbound: false,
    });
    securityGroupForApp.addIngressRule(securityGroupForAlb, ec2.Port.tcp(80));
    securityGroupForApp.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());
    this.appServerSecurityGroup = securityGroupForApp;

    //Security Group for RDS
    // const securityGroupForRDS = new ec2.SecurityGroup(this, 'SgRds', {
    //   vpc: props.prodVpc,
    //   allowAllOutbound: false,
    // });
    // securityGroupForRDS.addIngressRule(securityGroupForApp, ec2.Port.tcp(3306));
    // securityGroupForRDS.addEgressRule(securityGroupForApp, ec2.Port.allTcp());


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
    const albLogBucket = new s3.Bucket(this, 'AlbLogBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL        
    });

    // ALB for App Server
    const lbForApp = new elbv2.ApplicationLoadBalancer(this, 'AlbApp', {
      vpc: props.prodVpc,
      internetFacing: true,
      securityGroup: securityGroupForAlb,
      vpcSubnets: props.prodVpc.selectSubnets({
        subnetGroupName: 'Public'
      }),
    });
    lbForApp.logAccessLogs(albLogBucket);
    Tags.of(lbForApp).add('Environment', props.environment);

    // TargetGroup for App Server
    const tgForApp = new elbv2.ApplicationTargetGroup(this, 'TgApp', {
      vpc: props.prodVpc,
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

    const subnetAzs = props.prodVpc.selectSubnets({
      subnetGroupName: 'Private'
    }).availabilityZones;
    const numAzs = subnetAzs.length;
    
    for (let i=0; i<2; i++) {
      const instance = new ec2.Instance(this, 'AppEc2'+i, {
        vpc: props.prodVpc,
        availabilityZone:  subnetAzs[i%numAzs],
        vpcSubnets: props.prodVpc.selectSubnets({
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
