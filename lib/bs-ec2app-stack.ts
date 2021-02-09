import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as s3 from '@aws-cdk/aws-s3';
import * as rds from '@aws-cdk/aws-rds';
import * as iam from '@aws-cdk/aws-iam';
import * as cw from '@aws-cdk/aws-cloudwatch';
import { Duration, Tags, RemovalPolicy, SecretValue } from '@aws-cdk/core';
import * as path from 'path';
import * as fs from 'fs';
import * as kms from '@aws-cdk/aws-kms';

export interface BsEc2appStackProps extends cdk.StackProps {
  prodVpc: ec2.Vpc,
  pDBName: string,
  pDBUser: string,
  pDBPassword: string,
  pEnvironment: string,
  pAppInstanceType: ec2.InstanceType,
  pDBClass: ec2.InstanceType,
  pDBAllocatedStorage: number,
  logBucket: s3.Bucket,
  appKey: kms.IKey,
}

export class BsEc2appStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: BsEc2appStackProps) {
    super(scope, id, props);

      //Security Group of ALB for App
      const securityGroupForAlb = new ec2.SecurityGroup(this, 'security-group-for-alb', {
        vpc: props.prodVpc,
        description: 'For ALB Incoming access',
        allowAllOutbound: false,
      });

      securityGroupForAlb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
      securityGroupForAlb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

      //Security Group for Instance of App
      const securityGroupForApp = new ec2.SecurityGroup(this, 'security-group-for-app', {
        vpc: props.prodVpc,
        description: 'for Appserver Instances',
        allowAllOutbound: false,
      });
      securityGroupForApp.addIngressRule(securityGroupForAlb, ec2.Port.tcp(80));
      securityGroupForApp.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

      //Security Group for RDS
      const securityGroupForRDS = new ec2.SecurityGroup(this, 'security-group-for-rds', {
        vpc: props.prodVpc,
        description: 'For RDS MySQL Access',
        allowAllOutbound: false,
      });

      securityGroupForRDS.addIngressRule(securityGroupForApp, ec2.Port.tcp(3306));
      securityGroupForRDS.addEgressRule(securityGroupForApp, ec2.Port.allTcp());

      //Create Subnet Group for RDS
      const dbSubnetGroup = new rds.SubnetGroup(this, 'rds-subnet-group', {
        description: 'MySQL RDS Subnet Group',
        vpc: props.prodVpc,
        vpcSubnets: {
          subnetGroupName: 'ProdProtectedSubnet'
        }
      });

      //Create InstanceProfile for SSM
      const ssmInstanceRole = new iam.Role(this, 'ssm-instance-role', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        path: '/',
        managedPolicies: [
          { managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' },
          { managedPolicyArn: 'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy' },
        ],
      });

   
      //Create S3 bucket for Web Content 
      const webContentBucket = new s3.Bucket(this, 'web-content-bucket', {
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


      const webContentBucketPolicyJSON = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Condition": {
                    "Bool": {
                        "aws:SecureTransport": "false"
                    }
                },
                "Action": "s3:*",
                "Resource": webContentBucket.bucketArn,
                "Effect": "Deny",
                "Principal": "*",
                "Sid":"EnforceSecureTransport"
            },
            {
              "Condition": {
                  "StringNotEquals": {
                      "s3:x-amz-server-side-encryption": "AES256"
                  }
              },
                "Action": "s3:PutObject",
                "Resource": webContentBucket.arnForObjects('*'),
                "Effect": "Deny",
                "Principal": "*",
                "Sid":"EnforceEncryptionOnPut"
            }
        ]
      };
      new s3.CfnBucketPolicy(this, 'web-contents-s3-policy', {
        bucket: webContentBucket.bucketName,
        policyDocument: webContentBucketPolicyJSON,
      });

      /* ************* DBServer ************* */

      // Create RDS MySQL Instance
      // const dbInstance = new rds.DatabaseInstance(this, 'db-mysql', {
      //   engine: rds.DatabaseInstanceEngine.mysql({
      //     version: rds.MysqlEngineVersion.VER_8_0_21,
      //   }),
      //   vpc: props.prodVpc,
      //   subnetGroup: dbSubnetGroup,
      //   securityGroups: [securityGroupForRDS],
      //   databaseName: props.pDBName,
      //   multiAz: true,
      //   storageEncrypted: true,
      //   storageEncryptionKey: props.appKey,
      //   credentials: {
      //     username: props.pDBUser,
      //     password: new SecretValue(props.pDBPassword),
      //   },
      //   instanceType: props.pDBClass,
      //   allocatedStorage: props.pDBAllocatedStorage,
      // });


      /* ************* AppServer ************* */

      // S3 Bucket for ALB Loggins (Needs SSE-S3)
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

      Tags.of(lbForApp).add('Environment', props.pEnvironment);

      // TargetGroup of ALB for App Server
      const tgForApp = new elbv2.ApplicationTargetGroup(this, 'tg-for-app', {
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

      Tags.of(tgForApp).add('Environment', props.pEnvironment);

      lbForApp.addListener('alb-listener-for-app', {
        port: 80, 
        open: true,
        defaultTargetGroups: [tgForApp], 
      });

      // Create Auto Scaling Group
      const fleetForApp = new autoscaling.AutoScalingGroup(this, 'auto-scaling-group-app', {
        vpc: props.prodVpc,
        minCapacity: 2,
        maxCapacity: 4,
        vpcSubnets: props.prodVpc.selectSubnets({
          subnetGroupName: 'ProdPrivateSubnet'
        }),
        healthCheck: autoscaling.HealthCheck.elb({
          grace: Duration.seconds(30)
        }),
        instanceType: props.pAppInstanceType,
        machineImage: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
        }),
        securityGroup: securityGroupForApp,
        role: ssmInstanceRole, 
      })



      // // Load Command of User Data
      const userDataForApp = ec2.UserData.forLinux({shebang: '#!/bin/bash'});
      userDataForApp.addCommands(
        "sudo yum -y install httpd",
        "sudo systemctl enable httpd",
        "sudo systemctl start httpd",
        "touch /var/www/html/index.html",
        "chown apache.apache /var/www/html/index.html",
      );

      fleetForApp.addUserData(userDataForApp.render());
      fleetForApp.attachToApplicationTargetGroup(tgForApp);

      //fleet.applyCloudFormationInit();
      Tags.of(fleetForApp).add('Environment', props.pEnvironment, {applyToLaunchedInstances: true,});
      Tags.of(fleetForApp).add('Name', 'AppServer', {applyToLaunchedInstances: true,});
      Tags.of(fleetForApp).add('Role', 'FRA_AppServer', {applyToLaunchedInstances: true,});




      const autoScalingUpAppPolicy = new autoscaling.CfnScalingPolicy(this, 'auto-scaling-up-app', {
        autoScalingGroupName: fleetForApp.autoScalingGroupName,
        adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
        scalingAdjustment: 2,
        cooldown: '180',
      });

    
      const autoScalingDownAppPolicy = new autoscaling.CfnScalingPolicy(this, 'auto-scaling-down-app', {
        autoScalingGroupName: fleetForApp.autoScalingGroupName,
        adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
        scalingAdjustment: -2,
        cooldown: '180',
      });


      new cw.Alarm(this, 'cw-alarm-high-cpu-app', {
        evaluationPeriods: 1,
        metric: new cw.Metric({
          metricName: 'AppServerCpuHighUtilization',
          period: Duration.seconds(60),
          namespace: 'AWS/EC2',
          dimensions: ['AutoScalingGroupName', fleetForApp.autoScalingGroupName],
        }),
        statistic: 'Average',
        threshold: 60,
        alarmDescription: 'Alarm if CPU too high or metric disappears indicating instance is down',
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmName: 'AppServerCpuHighUtilization',
      }).addAlarmAction({
      bind(scope, alarm){
        return {alarmActionArn: autoScalingUpAppPolicy.ref};
      },});

      new cw.Alarm(this, 'cw-alarm-low-cpu-app', {
        evaluationPeriods: 1,
        metric: new cw.Metric({
          metricName: 'AppServerCpuLowUtilization',
          period: Duration.seconds(180),
          namespace: 'AWS/EC2',
          dimensions: ['AutoScalingGroupName', fleetForApp.autoScalingGroupName],
        }),
        statistic: 'Maximum',
        threshold: 10,
        alarmDescription: 'Alarm if CPU too low, remove an app server',
        comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
        alarmName: 'AppServerCpuLowUtilization',
      }).addAlarmAction({
        bind(scope, alarm){
          return {alarmActionArn: autoScalingDownAppPolicy.ref};
        },});


  }
}
