import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as s3 from '@aws-cdk/aws-s3';
import * as rds from '@aws-cdk/aws-rds';
import * as iam from '@aws-cdk/aws-iam';
import * as cw from '@aws-cdk/aws-cloudwatch';
import { Duration, Tags, RemovalPolicy, SecretValue } from '@aws-cdk/core';
import * as path from 'path'
import * as fs from 'fs' 

export interface NiscApplicationStackProps extends cdk.StackProps {
  prodVpc: ec2.Vpc,
  prodVpcCidr: string,
  mgmtVpc: ec2.Vpc,
  mgmtVpcCidr: string,
  pDBName: string,
  pDBUser: string,
  pDBPassword: string,
  pEC2KeyPair: string,
  pEnvironment: string,
  pAppInstanceType: ec2.InstanceType,
  pAppAmi: string,
  pDBClass: ec2.InstanceType,
  pDBAllocatedStorage: number,
  pWebInstanceType: ec2.InstanceType,
  pWebServerAMI: string,
}

export class NiscApplicationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: NiscApplicationStackProps) {
    super(scope, id, props);

      //Security Group of ALB for App
      const securityGroupFroApp = new ec2.SecurityGroup(this, 'rSecurityGroupApp', {
        vpc: props.prodVpc,
        securityGroupName: 'app-server-elb',
        description: 'Security group for Appservers ELB',
        allowAllOutbound: false,
      });

      securityGroupFroApp.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
      securityGroupFroApp.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
      securityGroupFroApp.addIngressRule(ec2.Peer.ipv4(props.prodVpcCidr), ec2.Port.tcp(443));
      securityGroupFroApp.addIngressRule(ec2.Peer.ipv4(props.mgmtVpcCidr), ec2.Port.tcp(22));

      //Security Group for Instance of App
      const securityGroupFroAppInstance = new ec2.SecurityGroup(this, 'rSecurityGroupAppInstance', {
        vpc: props.prodVpc,
        securityGroupName: 'app-server-elb-instances',
        description: 'Security group for Appserver Instances',
        allowAllOutbound: false,
      });

      securityGroupFroAppInstance.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
      securityGroupFroAppInstance.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
      securityGroupFroAppInstance.addEgressRule(ec2.Peer.ipv4(props.prodVpcCidr), ec2.Port.tcp(123));
      securityGroupFroAppInstance.addEgressRule(ec2.Peer.ipv4(props.prodVpcCidr), ec2.Port.tcp(3306));
      //
      securityGroupFroAppInstance.addIngressRule(ec2.Peer.ipv4(props.prodVpcCidr), ec2.Port.tcp(443));
      securityGroupFroAppInstance.addIngressRule(ec2.Peer.ipv4(props.prodVpcCidr), ec2.Port.tcp(80));
      securityGroupFroAppInstance.addIngressRule(ec2.Peer.ipv4(props.mgmtVpcCidr), ec2.Port.tcp(22));

      //Security Group of ALB for Web
      const securityGroupFroWeb = new ec2.SecurityGroup(this, 'rSecurityGroupWeb', {
        vpc: props.prodVpc,
        securityGroupName: 'reverse-proxy-dmz',
        description: 'Security group for Reverse Proxy in DMZ',
        allowAllOutbound: false,
      });

      securityGroupFroWeb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
      securityGroupFroWeb.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
      securityGroupFroWeb.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

      //Security Group for Instance of Web
      const securityGroupFroWebInstance = new ec2.SecurityGroup(this, 'rSecurityGroupWebInstance', {
        vpc: props.prodVpc,
        securityGroupName: 'reverse-proxy-dmz-instances',
        description: 'Security group for Reverse Proxy Instances in DMZ',
        allowAllOutbound: false,
      });

      securityGroupFroWebInstance.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
      securityGroupFroWebInstance.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
      securityGroupFroWebInstance.addEgressRule(ec2.Peer.ipv4(props.prodVpcCidr), ec2.Port.tcp(123));
      //
      securityGroupFroWebInstance.addIngressRule(ec2.Peer.ipv4(props.prodVpcCidr), ec2.Port.tcp(443));
      securityGroupFroWebInstance.addIngressRule(ec2.Peer.ipv4(props.prodVpcCidr), ec2.Port.tcp(80));
      securityGroupFroWebInstance.addIngressRule(ec2.Peer.ipv4(props.mgmtVpcCidr), ec2.Port.tcp(22));

      //Security Group for RDS
      const securityGroupFroRDS = new ec2.SecurityGroup(this, 'rSecurityGroupRDS', {
        vpc: props.prodVpc,
        securityGroupName: 'database-access',
        description: 'Port 3306 database for access',
        allowAllOutbound: false,
      });

      securityGroupFroRDS.addIngressRule(securityGroupFroAppInstance, ec2.Port.tcp(3306));

      //Create Subnet Group for RDS
      const dbSubnetGroup = new rds.SubnetGroup(this, 'rDBSubnetGroup', {
        description: 'MySQL RDS Subnet Group',
        vpc: props.prodVpc,
        vpcSubnets: props.prodVpc.selectSubnets({
          subnetGroupName: 'Production DB Subnet'
       })
      });

      //Create InstanceProfile for SSM
      //Role
      const ssmInstanceRole = new iam.Role(this, 'rSSMInstanceRole', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        path: '/',
        managedPolicies: [{
          managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM'
        }],
      });

      //Create S3 bucket for ALB access Logs
      const loggingBucket = new s3.Bucket(this, 'rS3ELBAccessLogs', {
        accessControl: s3.BucketAccessControl.PRIVATE,
      });

      //add Policy for rS3ELBAccessLogs
      const policyForLoggingBucket = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        sid: 'ELBAccessLogs20130930',
      });

      policyForLoggingBucket.addResources(`arn:aws:s3:::${loggingBucket.bucketName}/Logs/AWSLogs/${this.account}/*`);
      policyForLoggingBucket.addAwsAccountPrincipal('582318560864'); //元YAMLで!FindInMap [ Variables, vELB, Principal ]べた書きだったが？
      policyForLoggingBucket.addActions('s3:PutObject');
      loggingBucket.addToResourcePolicy(policyForLoggingBucket);
      
   
      //Create S3 bucket for Web Content 
      const webContentBucket = new s3.Bucket(this, 'rWebContentBucket', {
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
      new s3.CfnBucketPolicy(this, 'rWebContentS3Policy', {
        bucket: webContentBucket.bucketName,
        policyDocument: webContentBucketPolicyJSON,
      });
      /*
      webContentBucket.addToResourcePolicy(new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: ["s3:*"],
        conditions:	{
          "Bool": {
              "aws:SecureTransport": "false"
          },
        },	
        principals:	[new iam.AnyPrincipal()],
        resources: [webContentBucket.bucketArn],
        sid: 'EnforceSecureTransport',
      }));

      webContentBucket.addToResourcePolicy(new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: ["s3:PutObject"],
        conditions:	{
          "StringNotEquals": {
              "s3:x-amz-server-side-encryption": "AES256"
          },
        },
        principals:	[new iam.AnyPrincipal()],
        resources: [webContentBucket.arnForObjects('*')],
        sid: 'EnforceSecureTransport',
      }));
      */

      /* ************* DBServer ************* */

      //Create RDS MySQL Instance
      const dbInstance = new rds.DatabaseInstance(this, 'rRDSInstanceMySQL', {
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0_21,
        }),
        vpc: props.prodVpc,
        subnetGroup: dbSubnetGroup,
        securityGroups: [securityGroupFroRDS],
        databaseName: props.pDBName,
        multiAz: true,
        storageEncrypted: true,
        credentials: {
          username: 'pDBUser',
          password: new SecretValue(props.pDBPassword),
        },
        instanceType: props.pDBClass,
        allocatedStorage: props.pDBAllocatedStorage,
      });


      /* ************* AppServer ************* */

      // Create ALB for App Server
      const lbForApp = new elbv2.ApplicationLoadBalancer(this, 'rALBForApp', {
        vpc: props.prodVpc,
        internetFacing: false,
        securityGroup: securityGroupFroApp,
        loadBalancerName: 'InternalAppALB',
        vpcSubnets: props.prodVpc.selectSubnets({
          subnetGroupName: 'Production App Subnet'
       }),
      });

      lbForApp.setAttribute('access_logs.s3.enabled', 'true');
      lbForApp.setAttribute('access_logs.s3.bucket', loggingBucket.bucketName);
      lbForApp.setAttribute('access_logs.s3.prefix', 'Logs');
      //TODO どっち？ lbForApp.logAccessLogs(loggingBucket,'Logs');

      Tags.of(lbForApp).add('Environment', props.pEnvironment);

      // Create TargetGroup of ALB for App Server
      const lbTGForApp = new elbv2.ApplicationTargetGroup(this, 'rALBTargetGroupForApp', {
        vpc: props.prodVpc,
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.INSTANCE,
        healthCheck: {
            path: "/landing.html",
            port: "80",
            protocol: elbv2.Protocol.HTTP,
            interval: Duration.seconds(15),
            timeout: Duration.seconds(5),
            unhealthyThresholdCount: 3,
            healthyHttpCodes: '200',
        },
        targetGroupName: "AppServerTargetGroup",
        deregistrationDelay: Duration.seconds(300),
      }); 

      Tags.of(lbTGForApp).add('Environment', props.pEnvironment);

      lbForApp.addListener('rALBListerForApp', {
        port: 80, 
        open: true,
        defaultTargetGroups: [lbTGForApp], 
      });

      // Create Auto Scaling Group
      const fleetForApp = new autoscaling.AutoScalingGroup(this, 'rAutoScalingGroupApp', {
        vpc: props.prodVpc,
        minCapacity: 2,
        maxCapacity: 4,
        vpcSubnets: props.prodVpc.selectSubnets({
          subnetGroupName: 'Production App Subnet'
        }),
        healthCheck: autoscaling.HealthCheck.elb({
          grace: Duration.seconds(300)
        }),
        instanceType: props.pAppInstanceType,
        machineImage: new ec2.AmazonLinuxImage(),//TODO pAppAmi
        securityGroup: securityGroupFroAppInstance,
        keyName: props.pEC2KeyPair,
        role: ssmInstanceRole, 
        //TODO init: ,
      })

      // Load Command of User Data
      const userDataForApp = ec2.UserData.forLinux({shebang: '#!/bin/bash'});

      // using fs & path, get sh file
      const scriptForApp = fs.readFileSync(
        path.join(__dirname, 'command', 'userDataForApp.sh'), {encoding: 'utf8'}
        );

      // Split with line code and add
      userDataForApp.addCommands(...scriptForApp.split('\n'));

      fleetForApp.attachToApplicationTargetGroup(lbTGForApp);
      fleetForApp.addUserData(cdk.Fn.base64(userDataForApp.render()));

      //fleet.applyCloudFormationInit();
      Tags.of(fleetForApp).add('Environment', props.pEnvironment, {applyToLaunchedInstances: true,});
      Tags.of(fleetForApp).add('Name', 'AppServer', {applyToLaunchedInstances: true,});
      Tags.of(fleetForApp).add('Role', 'FRA_AppServer', {applyToLaunchedInstances: true,});

      /* TODO
        rAutoScalingConfigApp:
        Type: AWS::AutoScaling::LaunchConfiguration\
        Metadata:
          AWS::CloudFormation::Init:
            configSets:
              wordpress_install:
                - install_cfn
                - install_wordpress
            install_cfn:
              files:
                /etc/cfn/cfn-hup.conf:
                  content: !Sub |
                    [main]
                    stack=${AWS::StackId}
                    region=${AWS::Region}
                  mode: '000400'
                  owner: root
                  group: root
                /etc/cfn/hooks.d/cfn-auto-reloader.conf:
                  content: !Sub |
                    [cfn-auto-reloader-hook]
                    triggers=post.update
                    path=Resources.rAutoScalingConfigApp.Metadata.AWS::CloudFormation::Init
                    action=/opt/aws/bin/cfn-init -v --stack ${AWS::StackName} --resource rAutoScalingGroupApp --configsets wordpress_install --region ${AWS::Region}
                  mode: '000400'
                  owner: root
                  group: root
              services:
                sysvinit:
                  cfn-hup:
                    enabled: true
                    ensureRunning: true
                    files:
                      - /etc/cfn/cfn-hup.conf
                      - /etc/cfn/hooks.d/cfn-auto-reloader.conf
            install_wordpress:
              packages:
                yum:
                  php: []
                  php-mysql: []
                  mysql: []
                  httpd: []
              sources:
                /var/www/html: https://wordpress.org/latest.tar.gz
              files:
                /var/www/html/wordpress/wp-config.php:
                  content: !Sub |
                    <?php
                    define('DB_NAME', '${pDBName}');
                    define('DB_USER', '${pDBUser}');
                    define('DB_PASSWORD', '${pDBPassword}');
                    define('DB_HOST', '${rRDSInstanceMySQL.Endpoint.Address}');
                    define('FORCE_SSL_ADMIN', true);
                    if (strpos($_SERVER['HTTP_X_FORWARDED_PROTO'], 'https') !== false) { $_SERVER['HTTPS']='on'; }
                    define('DB_CHARSET', 'utf8');
                    define('DB_COLLATE', '');

                    $table_prefix  = 'wp_';
                    define('WP_DEBUG', false);

                    if ( !defined('ABSPATH') )
                      define('ABSPATH', dirname(__FILE__) . '/');

                    require_once(ABSPATH . 'wp-settings.php');
                  mode: '000644'
                  owner: root
                  group: root
              services:
                sysvinit:
                  httpd:
                    enabled: true
                    ensureRunning: true
      */

      const autoScalingUpAppPolicy = new autoscaling.CfnScalingPolicy(this, 'rAutoScalingUpApp', {
        autoScalingGroupName: fleetForApp.autoScalingGroupName,
        adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
        scalingAdjustment: 2,
        cooldown: '180',
      });

      /*
      const autoScalingUpAppPolicy = new autoscaling.StepScalingAction(this, 'rAutoScalingUpApp', {
        autoScalingGroup: fleetForApp,
        //cooldown: Duration.seconds(180),
        adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      });

       autoScalingUpAppPolicy.addAdjustment({adjustment: 2, upperBound: 4});
      */
    
     const autoScalingDownAppPolicy = new autoscaling.CfnScalingPolicy(this, 'rAutoScalingDownApp', {
      autoScalingGroupName: fleetForApp.autoScalingGroupName,
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      scalingAdjustment: -2,
      cooldown: '180',
    });
      /*
      const autoScalingDownAppPolicy = new autoscaling.StepScalingAction(this, 'rAutoScalingDownApp', {
        autoScalingGroup: fleetForApp,
        //cooldown: Duration.seconds(180),
        adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      });

      autoScalingDownAppPolicy.addAdjustment({adjustment: -2, lowerBound: 2});
      */

      /* ************* WebServer ************* */

      // Create ALB for Web Server
      const lbForWeb = new elbv2.ApplicationLoadBalancer(this, 'rALBForWeb', {
        vpc: props.prodVpc,
        internetFacing: true,
        securityGroup: securityGroupFroWeb,
        loadBalancerName: 'ProxyWebALB',
        vpcSubnets: props.prodVpc.selectSubnets({
          subnetGroupName: 'Production DMZ Subnet'
       }),
      });

      lbForWeb.setAttribute('access_logs.s3.enabled', 'true');
      lbForWeb.setAttribute('access_logs.s3.bucket', loggingBucket.bucketName);
      lbForWeb.setAttribute('access_logs.s3.prefix', 'Logs');
      //TODO どっち？ lbForApp.logAccessLogs(loggingBucket,'Logs');

      Tags.of(lbForWeb).add('Environment', props.pEnvironment);
      Tags.of(lbForWeb).add('Name', 'ProxyWebALB');

      // Create TargetGroup of ALB for Web Server
      const lbTGForWeb = new elbv2.ApplicationTargetGroup(this, 'rALBTargetGroupForWeb', {
        vpc: props.prodVpc,
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.INSTANCE,
        healthCheck: {
            path: "/healthcheck",
            port: "80",
            protocol: elbv2.Protocol.HTTP,
            interval: Duration.seconds(30),
            timeout: Duration.seconds(5),
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 5,
            healthyHttpCodes: '200',
        },
        targetGroupName: "ProxyWebServerTargetGroup",
        deregistrationDelay: Duration.seconds(300),
      }); 

      Tags.of(lbTGForWeb).add('Name', 'ProxyWebServerTargetGroup');
      Tags.of(lbTGForWeb).add('Environment', props.pEnvironment);

      lbForWeb.addListener('rALBListerForWeb', {
        port: 80, 
        open: true,
        defaultTargetGroups: [lbTGForWeb], 
      });


      // Create Auto Scaling Group for Web Server
      const fleetForWeb = new autoscaling.AutoScalingGroup(this, 'rAutoScalingGroupWeb', {
        vpc: props.prodVpc,
        minCapacity: 2,
        maxCapacity: 4,
        vpcSubnets: props.prodVpc.selectSubnets({
          subnetGroupName: 'Production DMZ Subnet'
        }),
        healthCheck: autoscaling.HealthCheck.elb({
          grace: Duration.seconds(300)
        }),
        instanceType: props.pWebInstanceType,
        machineImage: new ec2.AmazonLinuxImage(),//TODO pWebServerAMI
        securityGroup: securityGroupFroWebInstance,
        keyName: props.pEC2KeyPair,
        role: ssmInstanceRole, 
        //TODO init
        associatePublicIpAddress: true,
      })

      /*
      rAutoScalingConfigWeb:
        Type: AWS::AutoScaling::LaunchConfiguration
        Metadata:
          AWS::CloudFormation::Init:
            config:
              packages:
                yum:
                  nginx: []
                  java-1.6.0-openjdk-devel: []
                  git: []
              files:
                /tmp/nginx/default.conf:
                  content: !Sub |
                    server {
                      listen 80;
                      charset utf-8;
                      location / {
                        resolver xxxxx;
                        set $elb 'https://${rALBForApp.DNSName}';
                        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                        proxy_set_header Host $http_host;
                        proxy_redirect off;
                        proxy_pass $elb;
                      }
                      location /healthcheck {
                        return 200 "OK";
                        add_header Content-Type text/plain;
                      }
                    }
                  mode: '000755'
                  owner: root
                  group: root
              commands:
                00-timesync-setup:
                  command: |
                    #!/bin/bash
                    ## Use Amazon Time Sync Service
                    yum -y erase ntp*
                    yum -y install chrony
                    service chronyd start
                    chkconfig chronyd on
                01-nginx-setup:
                  command: |
                    #!/bin/bash
                    ## Nginx setup
                    sleep 5
                    echo 'Replace resolver placeholder with /etc/resolv.conf nameservers'
                    sed -i "s/xxxxx/$(grep ^nameserver /etc/resolv.conf | sed 's/^nameserver//' | tr -d '\n')/" /tmp/nginx/default.conf
                    cp /tmp/nginx/default.conf /etc/nginx/conf.d/default.conf
                    service nginx stop
                    sed -i '/default_server;/d' /etc/nginx/nginx.conf
                    sleep 10
                    service nginx restart
              services:
                sysvinit:
                  nginx:
                    enabled: true
                    ensureRunning: true
                    files:
                      - /etc/nginx/conf.d/default.conf
      */

      // Load Command of User Data
      const userDataForWeb = ec2.UserData.forLinux({shebang: '#!/bin/bash'});

      // using fs & path, get sh file
      const scriptForWeb = fs.readFileSync(
        path.join(__dirname, 'command', 'userDataForWeb.sh'),{encoding: 'utf8'}
      );

      // Split with line code and add
      userDataForWeb.addCommands(...scriptForWeb.split('\n'));

      fleetForWeb.attachToApplicationTargetGroup(lbTGForApp);
      fleetForWeb.addUserData(cdk.Fn.base64(userDataForWeb.render()));

      //fleet.applyCloudFormationInit();
      Tags.of(fleetForWeb).add('Environment', props.pEnvironment, {applyToLaunchedInstances: true,});
      Tags.of(fleetForWeb).add('Name', 'Web Proxy Server', {applyToLaunchedInstances: true,});
      Tags.of(fleetForWeb).add('Role', 'FRA_WebServer', {applyToLaunchedInstances: true,});



      const autoScalingUpWebPolicy = new autoscaling.CfnScalingPolicy(this, 'rAutoScalingUpWeb', {
        autoScalingGroupName: fleetForWeb.autoScalingGroupName,
        adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
        scalingAdjustment: 2,
        cooldown: '180',
      });

      /*
      const autoScalingUpWebPolicy = new autoscaling.StepScalingAction(this, 'rAutoScalingUpWeb', {
        autoScalingGroup: fleetForWeb,
        //cooldown: Duration.seconds(180),
        adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      });

      autoScalingUpWebPolicy.addAdjustment({adjustment: 2, upperBound: 4});
      */

     const autoScalingDownWebPolicy = new autoscaling.CfnScalingPolicy(this, 'rAutoScalingDownWeb', {
      autoScalingGroupName: fleetForWeb.autoScalingGroupName,
      adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      scalingAdjustment: -2,
      cooldown: '180',
    });
      /*
      const autoScalingDownWebPolicy = new autoscaling.StepScalingAction(this, 'rAutoScalingDownWeb', {
        autoScalingGroup: fleetForWeb,
        //cooldown: Duration.seconds(180),
        adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      });

      autoScalingDownWebPolicy.addAdjustment({adjustment: -2, lowerBound: 2});
      */



      new cw.Alarm(this, 'rCWAlarmHighCPUApp', {
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

      new cw.Alarm(this, 'rCWAlarmLowCPUApp', {
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



      //TODO
      new cw.Alarm(this, 'rCWAlarmHighCPUWeb', {
        evaluationPeriods: 1,
        metric: new cw.Metric({
          metricName: 'WebServerCpuHighUtilization',
          period: Duration.seconds(60),
          namespace: 'AWS/EC2',
          dimensions: ['AutoScalingGroupName', fleetForWeb.autoScalingGroupName],
        }),
        statistic: 'Average',
        threshold: 60,
        alarmDescription: 'Alarm if CPU too high or metric disappears indicating instance is down',
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmName: 'WebServerCpuHighUtilization',
      }).addAlarmAction({
      bind(scope, alarm){
        return {alarmActionArn: autoScalingUpWebPolicy.ref};
      },});

      //TODO
      new cw.Alarm(this, 'rCWAlarmLowCPUWeb', {
        evaluationPeriods: 1,
        metric: new cw.Metric({
          metricName: 'WebServerCpuLowUtilization',
          period: Duration.seconds(180),
          namespace: 'AWS/EC2',
          //
          dimensions: ['AutoScalingGroupName', fleetForWeb.autoScalingGroupName],
        }),
        statistic: 'Maximum',
        threshold: 10,
        alarmDescription: 'Alarm if CPU too low, remove a web server',
        comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
        alarmName: 'WebServerCpuLowUtilization',
      }).addAlarmAction({
        bind(scope, alarm){
          return {alarmActionArn: autoScalingDownWebPolicy.ref};
        },});



      //Create Role for Post Proc Instance 
      const postProcInstanceRole = new iam.Role(this, 'rPostProcInstanceRole', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        path: '/',
        inlinePolicies: {
          CloudWatchWritePolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                sid:'UploadServerCertificate',
                effect: iam.Effect.ALLOW, 
                actions: [
                  'iam:ListServerCertificates',
                  'iam:UploadServerCertificate',
                ],
                resources: ["*"]
              }),
              new iam.PolicyStatement({
                sid:'CreateLoadBalancerListener',
                effect: iam.Effect.ALLOW,
                actions: [
                  'elasticloadbalancing:CreateListener',
                ],
                resources: ["*"]
              }),
              new iam.PolicyStatement({
                sid:'PublishNotificationTopic',
                effect: iam.Effect.ALLOW,
                actions: [
                  'sns:Publish',
                ],
                resources: ["*"] //TODO pSecurityAlarmTopic
              }),
              new iam.PolicyStatement({
                sid:'SelfDestruct',
                effect: iam.Effect.ALLOW,
                actions: [
                  'ec2:TerminateInstances',
                ],
                resources: ["*"]
              }),
            ]
          })
        }
      });

      // Load Command of User Data
      const userDataForPostProc = ec2.UserData.forLinux({shebang: '#!/bin/bash'});

      // using fs & path, get sh file
      const scriptForPostProc = fs.readFileSync(
        path.join(__dirname, 'command', 'userDataForPostProc.sh'),{encoding: 'utf8'}
      );

      // Split with line code and add
      userDataForPostProc.addCommands(...scriptForPostProc.split('\n'));
      
      const postProcInstance = new ec2.Instance(this, 'rPostProcInstance',{
        instanceType: props.pAppInstanceType,
        machineImage: new ec2.AmazonLinuxImage(),//TODO pWebServerAMI
        role: postProcInstanceRole,
        vpc: props.prodVpc,
        vpcSubnets: props.prodVpc.selectSubnets({
          subnetGroupName: 'Production App Subnet'
        }),
        securityGroup: securityGroupFroAppInstance,
      });

      postProcInstance.addUserData(cdk.Fn.base64(userDataForPostProc.render()));

      Tags.of(postProcInstance).add('Name', 'PostProcessor');

  }
}
