import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2_targets as elbv2targets } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { region_info as ri } from 'aws-cdk-lib';
import { aws_autoscaling as autoscaling } from 'aws-cdk-lib';

export interface Ec2AppProps {
  vpc: ec2.IVpc;
  cmk: kms.IKey;
}

export class Ec2App extends Construct {
  public readonly appServerSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: Ec2AppProps) {
    super(scope, id);

    // --- Security Groups ---

    //Security Group of ALB for App
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: props.vpc,
      allowAllOutbound: false,
    });
    albSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

    //Security Group for Instance of App
    const appSg = new ec2.SecurityGroup(this, 'AppSg', {
      vpc: props.vpc,
      allowAllOutbound: false,
    });
    appSg.addIngressRule(albSg, ec2.Port.tcp(80));
    appSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());
    this.appServerSecurityGroup = appSg;

    // ------------ Application LoadBalancer ---------------

    // ALB for App Server
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: props.vpc.selectSubnets({
        subnetGroupName: 'Public',
      }),
    });

    // ALB Listener - TargetGroup
    const albListener = alb.addListener('AlbListener', {
      port: 80,
    });

    // Enable ALB Access Logging
    const albLogBucket = new s3.Bucket(this, 'AlbLogBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    alb.setAttribute('access_logs.s3.enabled', 'true');
    alb.setAttribute('access_logs.s3.bucket', albLogBucket.bucketName);

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

    // ------------ AppServers (Ec2.Instance) ---------------

    // InstanceProfile for AppServers
    const ssmInstanceRole = new iam.Role(this, 'SsmInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      path: '/',
      managedPolicies: [
        { managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore' },
        { managedPolicyArn: 'arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy' },
      ],
    });

    // UserData for AppServer (setup httpd)
    const userdata = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userdata.addCommands(
      'sudo yum -y install httpd',
      'sudo systemctl enable httpd',
      'sudo systemctl start httpd',
      'echo "<h1>Hello from $(hostname)</h1>" > /var/www/html/index.html',
      'chown apache.apache /var/www/html/index.html',
    );

    const privateAzs = props.vpc.selectSubnets({
      subnetGroupName: 'Private',
    }).availabilityZones;

    const instanceIdTargets: elbv2targets.InstanceIdTarget[] = new Array(0);
    for (let i = 0; i < 2; i++) {
      const instance = new ec2.Instance(this, `AppInstance${i}`, {
        vpc: props.vpc,
        availabilityZone: privateAzs[i % privateAzs.length],
        vpcSubnets: props.vpc.selectSubnets({
          subnetGroupName: 'Private',
        }),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
        machineImage: new ec2.AmazonLinuxImage({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        }),
        securityGroup: appSg,
        role: ssmInstanceRole,
        userData: userdata,
        blockDevices: [
          {
            deviceName: '/dev/xvda',
            volume: ec2.BlockDeviceVolume.ebs(10, {
              encrypted: true,
            }),
          },
        ],
      });
      // Tags for AppServers
      cdk.Tags.of(instance).add('Name', 'AppServer' + i, { applyToLaunchedInstances: true });
      instanceIdTargets.push(new elbv2targets.InstanceIdTarget(instance.instanceId, 80));
    }

    // ------------ AppServers (AutoScaling) ---------------

    // Auto Scaling Group for AppServers
    const appAsg = new autoscaling.AutoScalingGroup(this, 'AppAsg', {
      minCapacity: 2,
      maxCapacity: 4,
      vpc: props.vpc,
      vpcSubnets: props.vpc.selectSubnets({
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
      securityGroup: appSg,
      role: ssmInstanceRole,
      userData: userdata,
      healthCheck: autoscaling.HealthCheck.elb({
        grace: cdk.Duration.seconds(60),
      }),
    });

    // AutoScaling Policy
    appAsg.scaleOnCpuUtilization('keepSpareCPU', {
      targetUtilizationPercent: 50,
    });

    // Tags for AppServers
    cdk.Tags.of(appAsg).add('Name', 'AppServer', { applyToLaunchedInstances: true });

    // Add targets from AutoScaling Group and static EC2 instances
    albListener.addTargets('AppAsgTarget', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      targets: [appAsg, ...instanceIdTargets],
      deregistrationDelay: cdk.Duration.seconds(30),
    });
  }
}
