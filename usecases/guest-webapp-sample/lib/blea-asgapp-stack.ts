import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_autoscaling as autoscaling } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { region_info as ri } from 'aws-cdk-lib';

export interface BLEAASGAppStackProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  appKey: kms.IKey;
}

export class BLEAASGAppStack extends cdk.Stack {
  public readonly appServerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: BLEAASGAppStackProps) {
    super(scope, id, props);

    // --- Security Groups ---

    //Security Group of ALB for App
    const securityGroupForAlb = new ec2.SecurityGroup(this, 'SgAlb', {
      vpc: props.myVpc,
      allowAllOutbound: false,
    });
    securityGroupForAlb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

    //Security Group for Instance of App
    const securityGroupForApp = new ec2.SecurityGroup(this, 'SgApp', {
      vpc: props.myVpc,
      allowAllOutbound: false,
    });
    securityGroupForApp.addIngressRule(securityGroupForAlb, ec2.Port.tcp(80));
    securityGroupForApp.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());
    this.appServerSecurityGroup = securityGroupForApp;

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
    const userDataForApp = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userDataForApp.addCommands(
      'sudo yum -y install httpd',
      'sudo systemctl enable httpd',
      'sudo systemctl start httpd',
      'touch /var/www/html/index.html',
      'chown apache.apache /var/www/html/index.html',
    );

    // Auto Scaling Group for AppServers
    const fleetForApp = new autoscaling.AutoScalingGroup(this, 'AsgApp', {
      minCapacity: 2,
      maxCapacity: 4,
      vpc: props.myVpc,
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Private',
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: autoscaling.BlockDeviceVolume.ebs(10, {
            encrypted: true,
          }),
        },
      ],
      securityGroup: securityGroupForApp,
      role: ssmInstanceRole,
      userData: userDataForApp,
      healthCheck: autoscaling.HealthCheck.elb({
        grace: cdk.Duration.seconds(60),
      }),
    });

    // AutoScaling Policy
    fleetForApp.scaleOnCpuUtilization('keepSpareCPU', {
      targetUtilizationPercent: 50,
    });

    // Tags for AppServers
    cdk.Tags.of(fleetForApp).add('Name', 'AppServer', { applyToLaunchedInstances: true });
    cdk.Tags.of(fleetForApp).add('Role', 'FRA_AppServer', { applyToLaunchedInstances: true });

    // ------------ Application LoadBalancer ---------------

    // ALB for App Server
    const lbForApp = new elbv2.ApplicationLoadBalancer(this, 'AsgAlb', {
      vpc: props.myVpc,
      internetFacing: true,
      securityGroup: securityGroupForAlb,
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Public',
      }),
    });

    // Enable ALB Access Logging
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
    albLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject'],
        // ALB access logging needs S3 put permission from ALB service account for the region
        principals: [new iam.AccountPrincipal(ri.RegionInfo.get(cdk.Stack.of(this).region).elbv2Account)],
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

    // TargetGroup for App Server
    const tgForApp = new elbv2.ApplicationTargetGroup(this, 'TgAsgApp', {
      vpc: props.myVpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        enabled: true,
        path: '/index.html',
      },
      deregistrationDelay: cdk.Duration.seconds(60),
    });

    // ALB Listener - TargetGroup
    lbForApp.addListener('AsgListerner', {
      port: 80,
      defaultTargetGroups: [tgForApp],
    });

    // TargetGroup - AutoScalingGroup
    fleetForApp.attachToApplicationTargetGroup(tgForApp);
  }
}
