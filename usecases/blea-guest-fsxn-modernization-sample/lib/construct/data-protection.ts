import * as cdk from 'aws-cdk-lib';
import { aws_backup as backup, aws_events as events } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DataProtectionProps {
  fileSystemId: string;
  backupRetentionDays: number;
}

/**
 * Data Protection: AWS Backup integration for FSxN volumes.
 * Snapshot policies are handled by ONTAP default (daily/weekly).
 * FlexClone and TPS require ONTAP Custom Resource (reuse from Spec B).
 */
export class DataProtection extends Construct {
  constructor(scope: Construct, id: string, props: DataProtectionProps) {
    super(scope, id);

    const vault = new backup.BackupVault(this, 'Vault', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const plan = new backup.BackupPlan(this, 'Plan', {
      backupPlanName: 'fsxn-modernization-daily',
    });

    plan.addRule(
      new backup.BackupPlanRule({
        ruleName: 'DailyBackup',
        scheduleExpression: events.Schedule.cron({ hour: '3', minute: '0' }),
        deleteAfter: cdk.Duration.days(props.backupRetentionDays),
        backupVault: vault,
      }),
    );

    plan.addSelection('FsxnSelection', {
      resources: [
        backup.BackupResource.fromArn(
          `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:file-system/${props.fileSystemId}`,
        ),
      ],
    });
  }
}
