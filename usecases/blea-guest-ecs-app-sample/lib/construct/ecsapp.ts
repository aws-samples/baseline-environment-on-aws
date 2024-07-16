import * as cdk from 'aws-cdk-lib';
import {
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_events as cwe,
  aws_events_targets as cwet,
  aws_iam as iam,
  aws_kms as kms,
  aws_logs as cwl,
  aws_s3 as s3,
  aws_sns as sns,
  Names,
  PhysicalName,
  region_info as ri,
} from 'aws-cdk-lib';
import { IAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { ILoadBalancerV2 } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface EcsAppProps {
  vpc: ec2.IVpc;
  cmk: kms.IKey;
  alarmTopic: sns.ITopic;
  dbCluster: IDatabaseCluster;
}

export class EcsApp extends Construct {
  public readonly albFullName: string;
  public readonly albTargetGroupName: string;
  public readonly albTargetGroupUnhealthyHostCountAlarm: IAlarm;
  public readonly ecsClusterName: string;
  public readonly ecsServiceName: string;
  public readonly ecsTargetUtilizationPercent: number;
  public readonly ecsScaleOnRequestCount: number;
  public readonly alb: ILoadBalancerV2;

  constructor(scope: Construct, id: string, props: EcsAppProps) {
    super(scope, id);

    // ------------ Application LoadBalancer ---------------
    //Security Group of ALB for App
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: props.vpc,
      allowAllOutbound: true,
    });

    // ALB for App Server
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: props.vpc.selectSubnets({
        subnetGroupName: 'Public',
      }),
      loadBalancerName: PhysicalName.GENERATE_IF_NEEDED, // for crossRegionReference
    });
    this.alb = alb;
    this.albFullName = alb.loadBalancerFullName;

    const albListener = alb.addListener('AlbSslListener', {
      port: 80,
    });

    // Enable ALB Access Logging
    //
    // This bucket can not be encrypted with KMS CMK
    // See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    //
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

    // --------------------- Fargate Cluster ----------------------------

    // ---- PreRequesties

    // Role for ECS Agent
    // The task execution role grants the Amazon ECS container and Fargate agents permission to make AWS API calls on your behalf.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html
    const taskExecutionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
      inlinePolicies: {
        ecrPullThroughCache:
          // https://docs.aws.amazon.com/AmazonECR/latest/userguide/pull-through-cache.html#pull-through-cache-iam
          new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ['ecr:BatchImportUpstreamImage', 'ecr:CreateRepository'],
                resources: ['*'],
              }),
            ],
          }),
      },
    });

    // Role for Container
    // With IAM roles for Amazon ECS tasks, you can specify an IAM role that can be used by the containers in a task.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
    const taskRole = new iam.Role(this, 'EcsTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // SecurityGroup for Fargate service
    // - Inbound access will be added automatically on associating ALB
    // - Outbound access will be used for DB and AWS APIs
    const appSg = new ec2.SecurityGroup(this, 'AppSg', {
      vpc: props.vpc,
      allowAllOutbound: true, // for AWS APIs
    });
    props.dbCluster.connections.allowDefaultPortFrom(appSg);

    // CloudWatch Logs Group for Container
    const appLogGroup = new cwl.LogGroup(this, 'AppLogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
      encryptionKey: props.cmk,
    });

    // Permission to access KMS Key from CloudWatch Logs
    props.cmk.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal(`logs.${cdk.Stack.of(this).region}.amazonaws.com`)],
        resources: ['*'],
        conditions: {
          ArnLike: {
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${cdk.Stack.of(this).region}:${
              cdk.Stack.of(this).account
            }:*`,
          },
        },
      }),
    );

    // ---- Cluster definition

    // Fargate Cluster
    // -  Enabling CloudWatch ContainerInsights
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
      clusterName: PhysicalName.GENERATE_IF_NEEDED, // for crossRegionReferences
    });
    this.ecsClusterName = cluster.clusterName;

    // Task definition
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      executionRole: taskExecutionRole,
      taskRole: taskRole,
      cpu: 256,
      memoryLimitMiB: 512,
    });

    // Container Registry
    // - Using pull through cache rules
    //   https://docs.aws.amazon.com/AmazonECR/latest/userguide/pull-through-cache.html
    //   ecrRepositoryPrefix must start with a letter and can only contain lowercase letters, numbers, hyphens, and underscores and max length is 20.
    const ecrRepositoryPrefix = Names.uniqueResourceName(this, {
      maxLength: 20,
      separator: '-',
    }).toLowerCase();
    new ecr.CfnPullThroughCacheRule(this, 'PullThroughCacheRule', {
      ecrRepositoryPrefix: ecrRepositoryPrefix,
      upstreamRegistryUrl: 'public.ecr.aws',
    });

    // Container
    const containerImage = 'docker/library/httpd';
    const containerRepository = ecr.Repository.fromRepositoryName(
      this,
      'PullThrough',
      `${ecrRepositoryPrefix}/${containerImage}`,
    );

    // The repository is automatically created by pull through cache, but you must specify it explicitly to enable ImageScanonPush.
    new ecr.Repository(this, 'Repository', {
      repositoryName: containerRepository.repositoryName,
      imageScanOnPush: true,
    });

    const ecsContainer = taskDefinition.addContainer('App', {
      // -- Option 1: If you want to use your ECR repository with pull through cache, you can use like this.
      image: ecs.ContainerImage.fromEcrRepository(containerRepository, 'latest'),

      // -- Option 2: If you want to use your ECR repository, you can use like this.
      // --           You Need to create your repository and dockerimage, then pass it to this stack.
      // image: ecs.ContainerImage.fromEcrRepository(props.repository, props.imageTag),

      // -- Option 3: If you want to use DockerHub, you can use like this.
      // --           You need public access route to internet for ECS Task.
      // --           See vpcSubnets property for new ecs.FargateService().
      // image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),

      environment: {
        ENVIRONMENT_VARIABLE_SAMPLE_KEY: 'Environment Variable Sample Value',
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'BLEA-ECSApp-',
        logGroup: appLogGroup,
      }),
      // -- SAMPLE: Get value from SecretsManager
      // secrets: {
      //   SECRET_VARIABLE_SAMPLE_KEY: ecs.Secret.fromSecretsManager(secretsManagerConstruct, 'secret_key'),
      // },
    });

    ecsContainer.addPortMappings({
      containerPort: 80,
    });

    // Service
    const service = new ecs.FargateService(this, 'Service', {
      cluster,
      taskDefinition,
      desiredCount: 2,

      // The LATEST is recommended platform version.
      // But if you need another version replace this.
      // See also:
      // - https://docs.aws.amazon.com/AmazonECS/latest/userguide/platform_versions.html
      // - https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.FargatePlatformVersion.html
      platformVersion: ecs.FargatePlatformVersion.LATEST,

      // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html#fargate-capacity-providers
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE',
          weight: 1,
        },
        // -- SAMPLE: Fargate Spot
        //{
        //  capacityProvider: 'FARGATE_SPOT',
        //  weight: 2,
        //},
      ],
      vpcSubnets: props.vpc.selectSubnets({
        // subnetGroupName: 'Private', // For public DockerHub
        subnetGroupName: 'Protected', // For your ECR. Need to use PrivateLinke for ECR
      }),
      securityGroups: [appSg],
      serviceName: PhysicalName.GENERATE_IF_NEEDED, // for crossRegionReferences
    });
    this.ecsServiceName = service.serviceName;

    // Define ALB Target Group
    // https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.ApplicationTargetGroup.html
    const appTargetGroup = albListener.addTargets('AppTargetGroup', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      deregistrationDelay: cdk.Duration.seconds(30),
    });
    this.albTargetGroupName = appTargetGroup.targetGroupName;

    // SAMPLE: Another way, how to set attibute to TargetGroup - example) Modify algorithm type
    // lbForAppTargetGroup.setAttribute('load_balancing.algorithm.type', 'least_outstanding_requests');

    // SAMPLE: Setup HealthCheck for app
    // lbForAppTargetGroup.configureHealthCheck({
    //   path: '/health',
    //   enabled: true,
    // });

    // ECS Task AutoScaling
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html#task-auto-scaling
    const ecsScaling = service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    // Scaling with CPU Utilization avarage on all tasks
    this.ecsTargetUtilizationPercent = 50; // Used in Dashboard Stack
    ecsScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: this.ecsTargetUtilizationPercent,
    });

    // Scaling with Requests per tasks
    this.ecsScaleOnRequestCount = 10000; // Used in Dashboard Stack
    ecsScaling.scaleOnRequestCount('RequestScaling', {
      requestsPerTarget: this.ecsScaleOnRequestCount,
      targetGroup: appTargetGroup,
    });

    // ----------------------- Alarms for ECS -----------------------------
    service
      .metricCpuUtilization({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'FargateCpuUtil', {
        evaluationPeriods: 3,
        datapointsToAlarm: 3,
        threshold: 80,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // RunningTaskCount - CloudWatch Container Insights metric (Custom metric)
    // This is a sample of full set configuration for Metric and Alarm
    // See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html#alarm-evaluation
    //
    // new cw.Metric({
    //   metricName: 'RunningTaskCount',
    //   namespace: 'ECS/ContainerInsights',
    //    dimensionsMap: {
    //     ClusterName: ecsCluster.clusterName,
    //     ServiceName: ecsService.serviceName,
    //   },
    //   period: cdk.Duration.minutes(1),
    //   statistic: cw.Stats.AVERAGE,
    // })
    //   .createAlarm(this, 'RunningTaskCount', {
    //     evaluationPeriods: 3,
    //     datapointsToAlarm: 2,
    //     threshold: 1,
    //     comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
    //     actionsEnabled: true,
    //   })
    //   .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // ----------------------- Alarms for ALB -----------------------------

    // Alarm for ALB - ResponseTime
    alb.metrics
      .targetResponseTime({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'AlbResponseTime', {
        evaluationPeriods: 3,
        threshold: 100,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Alarm for ALB - HTTP 4XX Count
    alb.metrics
      .httpCodeElb(elbv2.HttpCodeElb.ELB_4XX_COUNT, {
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.SUM,
      })
      .createAlarm(this, 'AlbHttp4xx', {
        evaluationPeriods: 3,
        threshold: 10,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Alarm for ALB - HTTP 5XX Count
    alb.metrics
      .httpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT, {
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.SUM,
      })
      .createAlarm(this, 'AlbHttp5xx', {
        evaluationPeriods: 3,
        threshold: 10,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Alarm for ALB TargetGroup - HealthyHostCount
    appTargetGroup.metrics
      .healthyHostCount({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'AlbTgHealthyHostCount', {
        evaluationPeriods: 3,
        threshold: 1,
        comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Alarm for ALB TargetGroup - UnHealthyHostCount
    // This alarm will be used on Dashbaord
    const albTargetGroupUnhealthyHostCountAlarm = appTargetGroup.metrics
      .unhealthyHostCount({
        period: cdk.Duration.minutes(1),
        statistic: cw.Stats.AVERAGE,
      })
      .createAlarm(this, 'AlbTgUnHealthyHostCount', {
        evaluationPeriods: 3,
        threshold: 1,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
        alarmName: PhysicalName.GENERATE_IF_NEEDED, // for crossRegionReferences
      });
    albTargetGroupUnhealthyHostCountAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
    this.albTargetGroupUnhealthyHostCountAlarm = albTargetGroupUnhealthyHostCountAlarm;

    // ----------------------- Event notification for ECS -----------------------------
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_cwe_events.html#ecs_service_events
    new cwe.Rule(this, 'ECSServiceActionEventRule', {
      description: 'CloudWatch Event Rule to send notification on ECS Service action events.',
      enabled: true,
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Service Action'],
        detail: {
          eventType: ['WARN', 'ERROR'],
        },
      },
      targets: [new cwet.SnsTopic(props.alarmTopic)],
    });

    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_cwe_events.html#ecs_service_deployment_events
    new cwe.Rule(this, 'ECSServiceDeploymentEventRule', {
      description: 'CloudWatch Event Rule to send notification on ECS Service deployment events.',
      enabled: true,
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Deployment State Change'],
        detail: {
          eventType: ['WARN', 'ERROR'],
        },
      },
      targets: [new cwet.SnsTopic(props.alarmTopic)],
    });
  }
}
