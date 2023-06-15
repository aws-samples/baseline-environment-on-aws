# How to migrate to BLEA v3

See [Release note](https://github.com/aws-samples/baseline-environment-on-aws/releases/tag/v3.0.0) to check differences with v2.

## Summary

Each use case was comprised of multiple stacks in BLEA v2, but v3 changed to a single-stack configuration (using multiple stacks only when needed, such as the multi-region guest system sample). Therefore, migrating to v3 requires deleting and re-creating stacks that have already been deployed. This migration guide shows the impact on services that hold logs and findings, such as AWS CloudTrail, AWS Config, and AWS Security Hub.

## Stack configuration in BLEA v2 and impact of resource re-creation

\*If **Impact of resource re-creation** is “-”, it means that resource deletion and re-creation have no effect.

### BLEAChatbotStack (Standalone, Multi-account)

| Types of resources                         | Logical ID       | Behavior of stack destruction | Impact of resource re-creation |
| ------------------------------------------ | ---------------- | ----------------------------- | ------------------------------ |
| `aws_iam.Role`                             | `ChatbotRole`    | Delete                        | -                              |
| `aws_chatbot.CfnSlackChannelConfiguration` | `ChatbotChannel` | Delete                        | -                              |

### BLEAConfigRulesStack (Standalone, Multi-account)

| Types of resources                       | Logical ID                           | Behavior of stack destruction | Impact of resource re-creation |
| ---------------------------------------- | ------------------------------------ | ----------------------------- | ------------------------------ |
| `aws_config.ManagedRule`                 | `BLEARuleDefaultSecurityGroupClosed` | Delete                        | -                              |
| `aws_iam.Role`                           | `RemoveSecGroupRemediationRole`      | Delete                        | -                              |
| `aws_config.CfnRemediationConfiguration` | `RmDefaultSg`                        | Delete                        | -                              |

### BLEAIamStack (Standalone, Multi-account)

| Types of resources      | Logical ID           | Behavior of stack destruction | Impact of resource re-creation |
| ----------------------- | -------------------- | ----------------------------- | ------------------------------ |
| `aws_iam.ManagedP○licy` | `SysAdminPolicy`etc. | Delete                        | -                              |
| `aws_iam.Role`          | `SysAdminRole`etc.   | Delete                        | -                              |
| `aws_iam.Group`         | `SysAdminGroup`etc.  | Delete                        | -                              |

### BLEASecurityAlarmStack (Standalone, Multi-account)

| Types of resources      | Logical ID                 | Behavior of stack destruction | Impact of resource re-creation |
| ----------------------- | -------------------------- | ----------------------------- | ------------------------------ |
| `aws_sns.Topic`         | `SecurityAlarmTopic`       | Delete                        | -                              |
| `aws_events.Rule`       | `BLEARuleConfigRules`etc.  | Delete                        | -                              |
| `aws_logs.MetricFilter` | `IAMPolicyChange`etc.      | Delete                        | -                              |
| `aws_cloudwatch.Alarm`  | `IAMPolicyChangeAlarm`etc. | Delete                        | -                              |

### BLEATrailStack (Standalone, Multi-account)

| Types of resources     | Logical ID           | Behavior of stack destruction | Impact of resource re-creation                                                                                                                                                 |
| ---------------------- | -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aws_s3.Bucket`        | `ArchiveLogsBucket`  | Retain                        | -                                                                                                                                                                              |
| `aws_s3.Bucket`        | `CloudTrailBucket`   | Retain                        | A new S3 bucket is created to store the CloudTrail trail. <br />To search for trails recorded in v2 on Amazon Athena, you need to query different data sources.                |
| `aws_kms.Key`          | `CloudTrailKey`      | Retain                        | A new CMK is created to encrypt the CloudWatch Logs LogGroup that records CloudTrail events. <br />If you keep LogGroup that is created in v2, you should to keep the old CMK. |
| `aws_logs.LogGroup`    | `CloudTrailLogGroup` | Retain                        | A new CloudWatch Logs LogGroup is created to record CloudTrail events. <br />To search event logs recorded in v2, you need to query different LogGroup.                        |
| `aws_cloudtrail.Trail` | `CloudTrail`         | Delete                        | -                                                                                                                                                                              |

### BLEAConfigCtGuardrailStack (Standalone)

| Types of resources | Logical ID   | Behavior of stack destruction | Impact of resource re-creation |
| ------------------ | ------------ | ----------------------------- | ------------------------------ |
| `CfnInclude`       | `ConfigCtGr` | Delete                        | -                              |

### BLEAConfigStack (Standalone)

| Types of resources                    | Logical ID              | Behavior of stack destruction | Impact of resource re-creation                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam.Role`                        | `ConfigRole`            | Delete                        | -                                                                                                                                                                                                                                                                                                                             |
| `aws_config.CfnConfigurationRecorder` | `ConfigRecorder`        | Delete                        | Configuration item that was previously recorded is not deleted when you delete `Config Recorder`. <br />You can access it after re-enabling `Config Recorder`. <br />Ref:[delete-configuration-recorder](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/configservice/delete-configuration-recorder.html) |
| `aws_s3.Bucket`                       | `ConfigBucket`          | Retain                        | A new S3 bucket is created to store AWS Config configuration item. <br />To search configuration item recorded in v2, you need to query different data sources.                                                                                                                                                               |
| `aws_config.CfnDeliveryChannel`       | `ConfigDeliveryChannel` | Delete                        | -                                                                                                                                                                                                                                                                                                                             |

### BLEAGuarddutyStack (Standalone)

| Types of resources          | Logical ID          | Behavior of stack destruction | Impact of resource re-creation |
| --------------------------- | ------------------- | ----------------------------- | ------------------------------ |
| `aws_guardduty.CfnDetector` | `GuardDutyDetector` | Delete                        | -                              |

### BLEASecurityHubStack (Standalone)

| Types of resources             | Logical ID           | Behavior of stack destruction | Impact of resource re-creation                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aws_iam.CfnServiceLinkedRole` | `RoleForSecurityHub` | Delete                        | -                                                                                                                                                                                                                                                                                                                                                            |
| `aws_securityhub.CfnHub`       | `SecurityHub`        | Delete                        | A new Security Hub resource is re-created. The existing detection results will be deleted after 90 days when Security Hub was disabled.<br />You need to complete migration process during 90 days after disabling Security Hub.<br />Ref：[Disabling Security Hub](https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-disable.html) |

## How to migrate

1. Destroy all stacks of BLEA v2
   - In terminal, run `npx aws-cdk destroy --all -c environment={environment name} --profile {profile}` when you keep the source code of BLEA v2
   - In AWS management console, go to CloudFormation console, destroy all stacks of BLEA v2
2. Update BLEA v2 source code to BLEA v3
   - Pull and merge BLEA v3 source code from GitHub
   - Copy parameters from `cdk.json` to `parameter.ts`. See [4-1. Set deployment parameters](../README.md#4-1-set-deployment-parameters)
3. Deploy BLEA v3
   - Deploy BLEA v3 with [4-2. Deploy a governance base](../README.md#4-2-deploy-a-governance-base)
   - Migration is complete if there are no errors
