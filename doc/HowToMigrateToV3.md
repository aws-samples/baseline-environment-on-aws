# How to migrate to BLEAv3

Please check [the release note](https://github.com/aws-samples/baseline-environment-on-aws/releases/tag/v3.0.0) about differences with v2.

## Summary

As described in the release notes above, v3 was changed from a configuration with multiple stacks to a single stack configuration.

As a result, there are no changes to the governance baseline design policies and settings, but you need to re-create resources.

AWS Services with data such as logs and detection results, like AWS CloudTrail, AWS Config, and AWS Security Hub, need to consider handling that data.
The services and data that need to be considered are described individually, so please refer to them.

## The v2 stack configuration, the resources generated, and the impact when re-created

### Stacks are given by Standalone ver. and Multi-Account ver.

#### BLEAChatbotStack

| Types of resources                         | Logical ID       | The impact when re-created |
| ------------------------------------------ | ---------------- | -------------------------- |
| `aws_iam.Role`                             | `ChatbotRole`    | -                          |
| `aws_chatbot.CfnSlackChannelConfiguration` | `ChatbotChannel` | -                          |

#### BLEAConfigRulesStack

| Types of resources                       | Logical ID                           | The impact when re-created |
| ---------------------------------------- | ------------------------------------ | -------------------------- |
| `aws_config.ManagedRule`                 | `BLEARuleDefaultSecurityGroupClosed` | -                          |
| `aws_iam.Role`                           | `RemoveSecGroupRemediationRole`      | -                          |
| `aws_config.CfnRemediationConfiguration` | `RmDefaultSg`                        | -                          |

#### BLEAIamStack

| Types of resources      | Logical ID           | The impact when re-created |
| ----------------------- | -------------------- | -------------------------- |
| `aws_iam.ManagedP○licy` | `SysAdminPolicy`など | -                          |
| `aws_iam.Role`          | `SysAdminRole`など   | -                          |
| `aws_iam.Group`         | `SysAdminGroup`など  | -                          |

#### BLEASecurityAlarmStack

| Types of resources      | Logical ID                 | The impact when re-created |
| ----------------------- | -------------------------- | -------------------------- |
| `aws_sns.Topic`         | `SecurityAlarmTopic`       | -                          |
| `aws_events.Rule`       | `BLEARuleConfigRules`など  | -                          |
| `aws_logs.MetricFilter` | `IAMPolicyChange`など      | -                          |
| `aws_cloudwatch.Alarm`  | `IAMPolicyChangeAlarm`など | -                          |

#### BLEATrailStack

| Types of resources     | Logical ID           | The impact when re-created                                                                                                                                                                                                                                                                              |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `aws_s3.Bucket`        | `ArchiveLogsBucket`  | -                                                                                                                                                                                                                                                                                                       |
| `aws_s3.Bucket`        | `CloudTrailBucket`   | You re-create this resource.<br />But the bucket that created in v2 are existing after destroying stacks.<br />Because these bucket's `DeletionPolicy` is `RETAIN`.<br /> **You need two datasources for Athena to invoke a query.<br />Because the buckets are different before and after migration.** |
| `aws_kms.Key`          | `CloudTrailKey`      | You re-create this resource.<br />But you need to keep existing `Key` to encrypt/decrypt exsiting resources.                                                                                                                                                                                            |
| `aws_logs.LogGroup`    | `CloudTrailLogGroup` | You re-create this resource.<br />**You need to switch the `LogGroup` to search Trail logs before and after migration.<br />Because `LogGroup` that are before migration is existing in your environment.**                                                                                             |     |
| `aws_cloudtrail.Trail` | `CloudTrail`         | -                                                                                                                                                                                                                                                                                                       |

### Standalone 版のみで提供される Stack

#### BLEAConfigCtGuardrailStack

| Types of resources | Logical ID   | The impact when re-created |
| ------------------ | ------------ | -------------------------- |
| `CfnInclude`       | `ConfigCtGr` | -                          |

#### BLEAConfigStack

| Types of resources                    | Logical ID              | The impact when re-created                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam.Role`                        | `ConfigRole`            | -                                                                                                                                                                                                                                                                                                                                                                         |
| `aws_config.CfnConfigurationRecorder` | `ConfigRecorder`        | You re-create this resource.<br />If you delete `Config Recorder`, the configuration information that was previously recorded is not deleted.<br />And you can access this after enabling `Config Recorder`<br />Ref:[delete-configuration-recorder](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/configservice/delete-configuration-recorder.html) |
| `aws_s3.Bucket`                       | `ConfigBucket`          | You re-create this resource.<br />But the bucket that created in v2 are existing after destroying stacks. Because these bucket's `DeletionPolicy` is `RETAIN`.<br /> **You need two datasources for Athena to invoke a query. Because the buckets are different before and after migration.**                                                                             |
| `aws_config.CfnDeliveryChannel`       | `ConfigDeliveryChannel` | -                                                                                                                                                                                                                                                                                                                                                                         |

#### BLEAGuarddutyStack

| Types of resources          | Logical ID          | The impact when re-created |
| --------------------------- | ------------------- | -------------------------- |
| `aws_guardduty.CfnDetector` | `GuardDutyDetector` |                            |

#### BLEASecurityHubStack

| Types of resources             | Logical ID           | The impact when re-created                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam.CfnServiceLinkedRole` | `RoleForSecurityHub` | -                                                                                                                                                                                                                                                                                                                                                                 |
| `aws_securityhub.CfnHub`       | `SecurityHub`        | You re-create this resource.<br />But the existing detection results will be deleted after 90 days when Security Hub was disabled. So, the migration process need to be completed during 90 days from when Security Hub was disabled.<br />Ref：[Disabling Security Hub](https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-disable.html) |

## How to migrate

1. Destroy all BLEAv2's stacks that you use
   - In terminal, please run `npx aws-cdk destroy --all -c environment={environment name} --profile {profile}` when you keep the BLEAv2's source code in your directory.
   - In AWS management console, please go to CloudFormation's console, destroy all BLEAv2's stacks.
2. Update BLEAv2 source code to BLEAv3
   - Pull BLEAv3 source code to your directory from GitHub OR merge BLEAv3 source code to your directory manually.
3. Deploy BLEAv3
   - Please refer to [4-2. Deploy a governance base](../README.md#4-2-deploy-a-governance-base), and deploy BLEAv3 to your environment.
   - If there are no errors, migration is complete.
