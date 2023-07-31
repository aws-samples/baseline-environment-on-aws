import * as cdk from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { IAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface DashboardProps {
  dashboardName: string;
  distributionId: string;
  albFullName: string;
  albTargetGroupName: string;
  albTargetGroupUnhealthyHostCountAlarm: IAlarm;
  ecsClusterName: string;
  ecsServiceName: string;
  ecsTargetUtilizationPercent: number;
  ecsScaleOnRequestCount: number;
  dbClusterName: string;
  canaryDurationAlarm: IAlarm;
  canaryFailedAlarm: IAlarm;
}

export class Dashboard extends Construct {
  constructor(scope: Construct, id: string, props: DashboardProps) {
    super(scope, id);

    /*
     *
     * Metrics definition
     * Note: These definitions do not create any resource. Just dashboard widget refer to these metrics.
     *
     */

    // CloudFront
    // Available metrics: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/programming-cloudwatch-metrics.html
    const cfRequests = new cw.Metric({
      namespace: 'AWS/CloudFront',
      metricName: 'Requests',
      dimensionsMap: {
        Region: 'Global',
        DistributionId: props.distributionId,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.NONE,
      region: 'us-east-1', // cloudfront defined on us-east-1
    });
    const cf5xxErrorRate = new cw.Metric({
      namespace: 'AWS/CloudFront',
      metricName: '5xxErrorRate',
      dimensionsMap: {
        Region: 'Global',
        DistributionId: props.distributionId,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.PERCENT,
      region: 'us-east-1', // cloudfront defined on us-east-1
    });
    const cf4xxErrorRate = new cw.Metric({
      namespace: 'AWS/CloudFront',
      metricName: '4xxErrorRate',
      dimensionsMap: {
        Region: 'Global',
        DistributionId: props.distributionId,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.PERCENT,
      region: 'us-east-1', // cloudfront defined on us-east-1
    });
    new cw.Metric({
      namespace: 'AWS/CloudFront',
      metricName: 'TotalErrorRate',
      dimensionsMap: {
        Region: 'Global',
        DistributionId: props.distributionId,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.PERCENT,
      region: 'us-east-1', // cloudfront defined on us-east-1
    });

    // Application Load Balancing
    // Available metrics: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html
    const albRequests = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'RequestCount',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const albNewConnectionCount = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'NewConnectionCount',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const albRejectedConnectionCount = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'RejectedConnectionCount',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const albTLSNegotiationErrors = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'ClientTLSNegotiationErrorCount',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const alb5xxErrors = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_ELB_5XX_Count',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const alb4xxErrors = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_ELB_4XX_Count',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });

    // Target Group
    // Available metrics: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html
    const albTgRequests = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_2XX_Count',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const albTg5xxErrors = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_5XX_Count',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const albTg4xxErrors = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_4XX_Count',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const albTgConnectionErrors = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'TargetConnectionErrorCount',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const albTgTLSNegotiationErrors = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'TargetTLSNegotiationErrorCount',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const albTgResponseTime = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'TargetResponseTime',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.SECONDS,
    });
    const albTgRequestCountPerTarget = new cw.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'RequestCountPerTarget',
      dimensionsMap: {
        LoadBalancer: props.albFullName,
        TargetGroup: props.albTargetGroupName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });

    // ECS
    // Available metrics:
    // - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-metrics.html
    // - https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Container-Insights-metrics-ECS.html
    const ecsCPUUtilization = new cw.Metric({
      namespace: 'AWS/ECS',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        ClusterName: props.ecsClusterName,
        ServiceName: props.ecsServiceName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.PERCENT,
    });
    const ecsMemoryUtilization = new cw.Metric({
      namespace: 'AWS/ECS',
      metricName: 'MemoryUtilization',
      dimensionsMap: {
        ClusterName: props.ecsClusterName,
        ServiceName: props.ecsServiceName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.PERCENT,
    });
    const ecsDesiredTaskCount = new cw.Metric({
      namespace: 'ECS/ContainerInsights',
      metricName: 'DesiredTaskCount',
      dimensionsMap: {
        ClusterName: props.ecsClusterName,
        ServiceName: props.ecsServiceName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const ecsRunningTaskCount = new cw.Metric({
      namespace: 'ECS/ContainerInsights',
      metricName: 'RunningTaskCount',
      dimensionsMap: {
        ClusterName: props.ecsClusterName,
        ServiceName: props.ecsServiceName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const ecsPendingTaskCount = new cw.Metric({
      namespace: 'ECS/ContainerInsights',
      metricName: 'PendingTaskCount',
      dimensionsMap: {
        ClusterName: props.ecsClusterName,
        ServiceName: props.ecsServiceName,
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });

    // Aurora
    // Available metrics: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraMySQL.Monitoring.Metrics.html
    // for Writer & Reader
    const dbWriterDatabaseConnections = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'DatabaseConnections',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "Writer: ${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const dbReaderDatabaseConnections = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'DatabaseConnections',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'READER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.SUM,
      label: "Reader: ${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.COUNT,
    });
    const dbWriterCPUUtilization = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "Writer: ${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.PERCENT,
    });
    const dbReaderCPUUtilization = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'READER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "Reader: ${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.PERCENT,
    });
    const dbWriterFreeableMemory = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'FreeableMemory',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "Writer: ${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MEGABITS,
    });
    const dbReaderFreeableMemory = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'FreeableMemory',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'READER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "Reader: ${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MEGABITS,
    });
    const dbWriterFreeLocalStorage = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'FreeLocalStorage',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "Writer: ${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MEGABITS,
    });
    const dbReaderFreeLocalStorage = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'FreeLocalStorage',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'READER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "Reader: ${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MEGABITS,
    });

    // for Writer
    const dbWriterInsertLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'InsertLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MILLISECONDS,
    });
    const dbWriterSelectLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'SelectLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MILLISECONDS,
    });
    const dbWriterUpdateLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'UpdateLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MILLISECONDS,
    });
    const dbWriterCommitLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'CommitLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MILLISECONDS,
    });
    const dbWriterDDLLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'DDLLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MILLISECONDS,
    });
    const dbWriterDeleteLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'DeleteLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MILLISECONDS,
    });
    const dbWriterDMLLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'DMLLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MILLISECONDS,
    });
    const dbWriterReadLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'ReadLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.SECONDS,
    });
    const dbWriterWriteLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'WriteLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'WRITER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.SECONDS,
    });

    // for Reader
    const dbReaderSelectLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'SelectLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'READER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.MILLISECONDS,
    });
    const dbReaderReadLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'ReadLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'READER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.SECONDS,
    });
    const dbReaderWriteLatency = new cw.Metric({
      namespace: 'AWS/RDS',
      metricName: 'WriteLatency',
      dimensionsMap: {
        DBClusterIdentifier: props.dbClusterName,
        Role: 'READER',
      },
      period: cdk.Duration.minutes(1),
      statistic: cw.Stats.AVERAGE,
      label: "${PROP('MetricName')} /${PROP('Period')}sec",
      unit: cw.Unit.SECONDS,
    });

    /*
     *
     * Dashboard definition
     *
     * Note:
     * - This sample summarize widgets in metrics group such as Requests, ResponseTime, Errors, Resources.
     *   We added header text widget on top of each metrics group.
     * - If you use the name CloudWatch-Default, the dashboard appears on the overview on the CloudWatch home page.
     *   See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/create_dashboard.html
     *
     * - Widget Array Structure (height, width, x, y)
     *   width=24 means Full screen width. This sample is define widget height as 6.
     *   You can just add widgets in array, x and y axis are defined well by CDK.
     *   See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/CloudWatch-Dashboard-Body-Structure.html#CloudWatch-Dashboard-Properties-Widgets-Structure
     *
     * - "stacked: true," means stack(add) each metrics.
     *
     * - Label for each metrics is defined on metrics object and you can use "Dynamic Label".
     *   We usually use "${PROP('MetricName')} /${PROP('Period')}sec" so we can see period of the metrics.
     *   See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/graph-dynamic-labels.html
     *
     */

    const dashboard = new cw.Dashboard(this, 'Dashboard', {
      dashboardName: props.dashboardName,
    });
    dashboard.addWidgets(
      // Canary
      new cw.TextWidget({
        markdown: '# Canary',
        height: 1,
        width: 24,
      }),

      new cw.AlarmWidget({
        title: 'Canary response time',
        width: 12,
        height: 6,
        alarm: props.canaryDurationAlarm,
      }),
      new cw.AlarmWidget({
        title: 'Canary request failed',
        width: 12,
        height: 6,
        alarm: props.canaryFailedAlarm,
      }),

      // Requests
      new cw.TextWidget({
        markdown: '# Requests',
        height: 1,
        width: 24,
      }),
      new cw.GraphWidget({
        title: 'CloudFront Requests',
        width: 6,
        height: 6,
        stacked: false,
        left: [cfRequests],
      }),
      new cw.GraphWidget({
        title: 'ALB Requests',
        width: 6,
        height: 6,
        stacked: false,
        left: [albRequests, albNewConnectionCount, albRejectedConnectionCount],
      }),
      new cw.GraphWidget({
        title: 'Target Group Requests',
        width: 6,
        height: 6,
        stacked: false,
        left: [albTgRequests],
      }),
      new cw.GraphWidget({
        title: 'Aurora Connections',
        width: 6,
        height: 6,
        stacked: false,
        left: [dbWriterDatabaseConnections, dbReaderDatabaseConnections],
      }),

      // Response Time
      new cw.TextWidget({
        markdown: '# Response Time',
        height: 1,
        width: 24,
      }),
      new cw.GraphWidget({
        title: 'Target Group Response Time',
        width: 8,
        height: 6,
        stacked: false,
        left: [albTgResponseTime],
      }),
      new cw.GraphWidget({
        title: 'Aurora Operation Lantency (Writer)',
        width: 8,
        height: 6,
        stacked: false,
        left: [
          dbWriterInsertLatency,
          dbWriterSelectLatency,
          dbWriterUpdateLatency,
          dbWriterCommitLatency,
          dbWriterDDLLatency,
          dbWriterDeleteLatency,
          dbWriterDMLLatency,
        ],
        right: [dbWriterReadLatency, dbWriterWriteLatency],
      }),
      new cw.GraphWidget({
        title: 'Aurora Operation Lantency (Reader)',
        width: 8,
        height: 6,
        stacked: false,
        left: [dbReaderSelectLatency],
        right: [dbReaderReadLatency, dbReaderWriteLatency],
      }),

      // Errors
      new cw.TextWidget({
        markdown: '# Errors',
        height: 1,
        width: 24,
      }),
      new cw.GraphWidget({
        title: 'CloudFront Error Rates',
        width: 6,
        height: 6,
        // stacked: false,
        // left: [cf5xxErrorRate, cf4xxErrorRate, cfTotalErrorRate],
        stacked: true,
        left: [cf5xxErrorRate, cf4xxErrorRate],
      }),
      new cw.GraphWidget({
        title: 'ALB Errors',
        width: 6,
        height: 6,
        stacked: false,
        left: [albTLSNegotiationErrors, alb5xxErrors, alb4xxErrors],
      }),
      new cw.AlarmWidget({
        title: 'Alarm for UnHealthy Host in Target Group',
        width: 6,
        height: 6,
        alarm: props.albTargetGroupUnhealthyHostCountAlarm, // This alarm is defined on ECSApp Stack
      }),
      new cw.GraphWidget({
        title: 'Target Group Errors',
        width: 6,
        height: 6,
        // stacked: false,
        stacked: true,
        left: [albTg5xxErrors, albTg4xxErrors, albTgConnectionErrors, albTgTLSNegotiationErrors],
      }),

      // Resources
      new cw.TextWidget({
        markdown: '# Resources',
        height: 1,
        width: 24,
      }),
      new cw.GraphWidget({
        title: 'ECS CPU Utilization',
        width: 6,
        height: 6,
        stacked: false,
        left: [ecsCPUUtilization],
      }),
      new cw.GraphWidget({
        title: 'ECS Memory Utilization',
        width: 6,
        height: 6,
        stacked: false,
        left: [ecsMemoryUtilization],
      }),
      new cw.GraphWidget({
        title: 'ECS Desired Task Count',
        width: 6,
        height: 6,
        stacked: false,
        left: [ecsDesiredTaskCount],
      }),
      new cw.GraphWidget({
        title: 'ECS Task Count',
        width: 6,
        height: 6,
        stacked: true,
        left: [ecsRunningTaskCount, ecsPendingTaskCount],
      }),
      new cw.GraphWidget({
        title: 'ECS Auto Scaling with Requests per tasks',
        width: 12,
        height: 6,
        stacked: false,
        left: [albTgRequestCountPerTarget],
        leftAnnotations: [
          {
            value: props.ecsScaleOnRequestCount, // Defined on ECSApp Stack
            label: 'Threshold: Requests per tasks',
            color: '#aec7e8',
            fill: cw.Shading.BELOW,
          },
        ],
        right: [ecsRunningTaskCount, ecsPendingTaskCount],
      }),
      new cw.GraphWidget({
        title: 'ECS Auto Scaling with CPU Utilization',
        width: 12,
        height: 6,
        stacked: false,
        left: [ecsCPUUtilization],
        leftAnnotations: [
          {
            value: props.ecsTargetUtilizationPercent, // Defined on ECSApp Stack
            label: 'Threshold: CPU Utilization',
            color: '#aec7e8',
            fill: cw.Shading.BELOW,
          },
        ],
        right: [ecsRunningTaskCount, ecsPendingTaskCount],
      }),
      new cw.GraphWidget({
        title: 'Aurora CPU Utilization',
        width: 6,
        height: 6,
        stacked: false,
        left: [dbWriterCPUUtilization, dbReaderCPUUtilization],
      }),
      new cw.GraphWidget({
        title: 'Aurora Free Memory',
        width: 6,
        height: 6,
        stacked: false,
        left: [dbWriterFreeableMemory, dbReaderFreeableMemory],
      }),
      new cw.GraphWidget({
        title: 'Aurora Free Local Storage',
        width: 6,
        height: 6,
        stacked: false,
        left: [dbWriterFreeLocalStorage, dbReaderFreeLocalStorage],
      }),
    );
  }
}
