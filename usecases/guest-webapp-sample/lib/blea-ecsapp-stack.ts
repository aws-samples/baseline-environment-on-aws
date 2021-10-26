import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as iam from '@aws-cdk/aws-iam';
import * as kms from '@aws-cdk/aws-kms';
import * as ecs from '@aws-cdk/aws-ecs';
import * as sns from '@aws-cdk/aws-sns';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cwe from '@aws-cdk/aws-events';
import * as cwet from '@aws-cdk/aws-events-targets';
import * as cwl from '@aws-cdk/aws-logs';
import * as cw_actions from '@aws-cdk/aws-cloudwatch-actions';
import * as ecr from '@aws-cdk/aws-ecr';
import { IBLEAFrontend } from './blea-frontend-interface';

export interface BLEAECSAppStackProps extends cdk.StackProps {
  myVpc: ec2.Vpc;
  appKey: kms.IKey;
  repository: ecr.Repository;
  imageTag: string;
  alarmTopic: sns.Topic;
  webFront: IBLEAFrontend;
}

export class BLEAECSAppStack extends cdk.Stack {
  public readonly ecsClusterName: string;
  public readonly ecsServiceName: string;
  public readonly appTargetGroupName: string;
  public readonly appServerSecurityGroup: ec2.SecurityGroup;
  public readonly albTgUnHealthyHostCountAlarm: cw.Alarm;
  public readonly ecsTargetUtilizationPercent: number;
  public readonly ecsScaleOnRequestCount: number;

  constructor(scope: cdk.Construct, id: string, props: BLEAECSAppStackProps) {
    super(scope, id, props);

    // --------------------- Fargate Cluster ----------------------------

    // ---- PreRequesties

    // Role for ECS Agent
    // The task execution role grants the Amazon ECS container and Fargate agents permission to make AWS API calls on your behalf.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html
    const executionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    });

    // Role for Container
    // With IAM roles for Amazon ECS tasks, you can specify an IAM role that can be used by the containers in a task.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
    const serviceTaskRole = new iam.Role(this, 'EcsServiceTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // SecurityGroup for Fargate service
    // - Inbound access will be added automatically on associating ALB
    // - Outbound access will be used for DB and AWS APIs
    const securityGroupForFargate = new ec2.SecurityGroup(this, 'SgFargate', {
      vpc: props.myVpc,
      allowAllOutbound: true, // for AWS APIs
    });
    this.appServerSecurityGroup = securityGroupForFargate;

    // CloudWatch Logs Group for Container
    const fargateLogGroup = new cwl.LogGroup(this, 'FargateLogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
      encryptionKey: props.appKey,
    });

    // Permission to access KMS Key from CloudWatch Logs
    props.appKey.addToResourcePolicy(
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
    const ecsCluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.myVpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });
    this.ecsClusterName = ecsCluster.clusterName;

    // Task definition
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
    const ecsTask = new ecs.FargateTaskDefinition(this, 'EcsTask', {
      executionRole: executionRole,
      taskRole: serviceTaskRole,
      cpu: 256,
      memoryLimitMiB: 512,
    });

    // Container
    const ecsContainer = ecsTask.addContainer('EcsApp', {
      // -- SAMPLE: if you want to use your ECR repository, you can use like this.
      image: ecs.ContainerImage.fromEcrRepository(props.repository, props.imageTag),

      // -- SAMPLE: if you want to use DockerHub, you can use like this.
      // image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),

      environment: {
        ENVIRONMENT_VARIABLE_SAMPLE_KEY: 'Environment Variable Sample Value',
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'BLEA-ECSApp-',
        logGroup: fargateLogGroup,
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
    const ecsService = new ecs.FargateService(this, 'FargateService', {
      cluster: ecsCluster,
      taskDefinition: ecsTask,
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
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Private', // For public DockerHub
        //subnetGroupName: 'Protected'   // For your ECR. Need to use PrivateLinke for ECR
      }),
      securityGroups: [securityGroupForFargate],
    });
    this.ecsServiceName = ecsService.serviceName;

    // Define ALB Target Group
    // https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.ApplicationTargetGroup.html
    const lbForAppTargetGroup = props.webFront.appAlbListerner.addTargets('EcsApp', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [ecsService],
      deregistrationDelay: cdk.Duration.seconds(30),
    });
    this.appTargetGroupName = lbForAppTargetGroup.targetGroupFullName;

    // SAMPLE: Another way, how to set attibute to TargetGroup - example) Modify algorithm type
    // lbForAppTargetGroup.setAttribute('load_balancing.algorithm.type', 'least_outstanding_requests');

    // SAMPLE: Setup HealthCheck for app
    // lbForAppTargetGroup.configureHealthCheck({
    //   path: '/health',
    //   enabled: true,
    // });

    // ECS Task AutoScaling
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html#task-auto-scaling
    const ecsScaling = ecsService.autoScaleTaskCount({
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
      targetGroup: lbForAppTargetGroup,
    });

    // ----------------------- Alarms for ECS -----------------------------
    ecsService
      .metricCpuUtilization({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
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
    //   dimensions: {
    //     ClusterName: ecsCluster.clusterName,
    //     ServiceName: ecsService.serviceName,
    //   },
    //   period: cdk.Duration.minutes(1),
    //   statistic: cw.Statistic.AVERAGE,
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
    props.webFront.appAlb
      .metricTargetResponseTime({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'AlbResponseTime', {
        evaluationPeriods: 3,
        threshold: 100,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Alarm for ALB - HTTP 4XX Count
    props.webFront.appAlb
      .metricHttpCodeElb(elbv2.HttpCodeElb.ELB_4XX_COUNT, {
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.SUM,
      })
      .createAlarm(this, 'AlbHttp4xx', {
        evaluationPeriods: 3,
        threshold: 10,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Alarm for ALB - HTTP 5XX Count
    props.webFront.appAlb
      .metricHttpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT, {
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.SUM,
      })
      .createAlarm(this, 'AlbHttp5xx', {
        evaluationPeriods: 3,
        threshold: 10,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      })
      .addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

    // Alarm for ALB TargetGroup - HealthyHostCount
    lbForAppTargetGroup
      .metricHealthyHostCount({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
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
    this.albTgUnHealthyHostCountAlarm = lbForAppTargetGroup
      .metricUnhealthyHostCount({
        period: cdk.Duration.minutes(1),
        statistic: cw.Statistic.AVERAGE,
      })
      .createAlarm(this, 'AlbTgUnHealthyHostCount', {
        evaluationPeriods: 3,
        threshold: 1,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        actionsEnabled: true,
      });
    this.albTgUnHealthyHostCountAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));

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
