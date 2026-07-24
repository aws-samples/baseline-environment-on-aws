import * as cdk from 'aws-cdk-lib';
import {
  aws_glue as glue,
  aws_athena as athena,
  aws_iam as iam,
  aws_kms as kms,
  aws_lakeformation as lakeformation,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DataAnalyticsProps {
  s3AccessPointArn: string;
  s3AccessPointAlias: string;
  glueDatabaseName: string;
  glueCrawlerName: string;
  glueCrawlerSchedule: string;
  athenaWorkgroupName: string;
  kmsKey: kms.IKey;
}

export class DataAnalytics extends Construct {
  constructor(scope: Construct, id: string, props: DataAnalyticsProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // Glue Database
    new glue.CfnDatabase(this, 'GlueDatabase', {
      catalogId: accountId,
      databaseInput: {
        name: props.glueDatabaseName,
        description: 'Data catalog for FSx for NetApp ONTAP file data via S3 Access Point',
      },
    });

    // IAM Role for Glue Crawler (least privilege)
    const crawlerRole = new iam.Role(this, 'GlueCrawlerRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      description: 'IAM role for Glue Crawler to access FSxN S3 Access Point',
    });

    // S3 Access Point permissions (scoped to specific AP)
    crawlerRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [props.s3AccessPointArn, `${props.s3AccessPointArn}/object/*`],
      }),
    );

    // Glue Data Catalog permissions (scoped to specific database)
    crawlerRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'glue:GetDatabase',
          'glue:CreateTable',
          'glue:UpdateTable',
          'glue:DeleteTable',
          'glue:GetTable',
          'glue:GetTables',
          'glue:BatchGetPartition',
          'glue:CreatePartition',
          'glue:UpdatePartition',
          'glue:DeletePartition',
          'glue:BatchCreatePartition',
        ],
        resources: [
          `arn:aws:glue:${region}:${accountId}:catalog`,
          `arn:aws:glue:${region}:${accountId}:database/${props.glueDatabaseName}`,
          `arn:aws:glue:${region}:${accountId}:table/${props.glueDatabaseName}/*`,
        ],
      }),
    );

    // CloudWatch Logs permissions for Crawler
    crawlerRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [`arn:aws:logs:${region}:${accountId}:log-group:/aws-glue/crawlers:*`],
      }),
    );

    // Glue Crawler
    new glue.CfnCrawler(this, 'GlueCrawler', {
      name: props.glueCrawlerName,
      role: crawlerRole.roleArn,
      databaseName: props.glueDatabaseName,
      targets: {
        s3Targets: [
          {
            path: `s3://${props.s3AccessPointAlias}/`,
          },
        ],
      },
      schedule: {
        scheduleExpression: props.glueCrawlerSchedule,
      },
      schemaChangePolicy: {
        updateBehavior: 'UPDATE_IN_DATABASE',
        deleteBehavior: 'LOG',
      },
    });

    // Lake Formation permissions for Glue Crawler role
    // Required when Lake Formation is enabled (default in most accounts)
    new lakeformation.CfnPrincipalPermissions(this, 'LFCrawlerDatabasePermission', {
      principal: { dataLakePrincipalIdentifier: crawlerRole.roleArn },
      resource: {
        database: { catalogId: accountId, name: props.glueDatabaseName },
      },
      permissions: ['ALL'],
      permissionsWithGrantOption: ['ALL'],
    });

    new lakeformation.CfnPrincipalPermissions(this, 'LFCrawlerTablePermission', {
      principal: { dataLakePrincipalIdentifier: crawlerRole.roleArn },
      resource: {
        table: {
          catalogId: accountId,
          databaseName: props.glueDatabaseName,
          tableWildcard: {},
        },
      },
      permissions: ['ALL'],
      permissionsWithGrantOption: ['ALL'],
    });

    // S3 Bucket for Athena query results
    const queryResultsBucket = new s3.Bucket(this, 'AthenaQueryResultsBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90),
          id: 'DeleteOldQueryResults',
        },
      ],
    });

    // Athena Workgroup
    new athena.CfnWorkGroup(this, 'AthenaWorkgroup', {
      name: props.athenaWorkgroupName,
      state: 'ENABLED',
      workGroupConfiguration: {
        enforceWorkGroupConfiguration: true,
        resultConfiguration: {
          outputLocation: `s3://${queryResultsBucket.bucketName}/results/`,
          encryptionConfiguration: {
            encryptionOption: 'SSE_KMS',
            kmsKey: props.kmsKey.keyArn,
          },
        },
        engineVersion: {
          selectedEngineVersion: 'Athena engine version 3',
        },
      },
    });
  }
}
