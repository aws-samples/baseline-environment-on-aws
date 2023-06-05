# How to migrate to BLEAv3

Please check [the release note](https://github.com/aws-samples/baseline-environment-on-aws/releases/tag/v3.0.0) about differences with v2.

## Summary

As described in the release notes above, v3 was changed from a configuration with multiple stacks to a single stack configuration.

As a result, there are no changes to the governance baseline design policies and settings, but you need to re-create resources.

AWS Services with data such as logs and detection results, like AWS CloudTrail, AWS Config, and AWS Security Hub, need to consider handling that data.
The services and data that need to be considered are described individually, so please refer to them.

## The v2 stack configuration, the resources generated, and the impact when re-created

\*If **the impact when re-created** is “-”, it means that there is no particular effect. Therefore, if resource creation is successful when v3 is deployed, migration is success.

### Stacks are given by Standalone ver. and Multi-Account ver.

#### BLEAChatbotStack

| Types of resources                         | Logical ID       | Behavior when destroyed | The impact when re-created |
| ------------------------------------------ | ---------------- | ----------------------- | -------------------------- |
| `aws_iam.Role`                             | `ChatbotRole`    | Delete                  | -                          |
| `aws_chatbot.CfnSlackChannelConfiguration` | `ChatbotChannel` | Delete                  | -                          |

#### BLEAConfigRulesStack

| Types of resources                       | Logical ID                           | Behavior when destroyed | The impact when re-created |
| ---------------------------------------- | ------------------------------------ | ----------------------- | -------------------------- |
| `aws_config.ManagedRule`                 | `BLEARuleDefaultSecurityGroupClosed` | Delete                  | -                          |
| `aws_iam.Role`                           | `RemoveSecGroupRemediationRole`      | Delete                  | -                          |
| `aws_config.CfnRemediationConfiguration` | `RmDefaultSg`                        | Delete                  | -                          |

#### BLEAIamStack

| Types of resources      | Logical ID           | Behavior when destroyed | The impact when re-created |
| ----------------------- | -------------------- | ----------------------- | -------------------------- |
| `aws_iam.ManagedP○licy` | `SysAdminPolicy`etc. | Delete                  | -                          |
| `aws_iam.Role`          | `SysAdminRole`etc.   | Delete                  | -                          |
| `aws_iam.Group`         | `SysAdminGroup`etc.  | Delete                  | -                          |

#### BLEASecurityAlarmStack

| Types of resources      | Logical ID                 | Behavior when destroyed | The impact when re-created |
| ----------------------- | -------------------------- | ----------------------- | -------------------------- |
| `aws_sns.Topic`         | `SecurityAlarmTopic`       | Delete                  | -                          |
| `aws_events.Rule`       | `BLEARuleConfigRules`etc.  | Delete                  | -                          |
| `aws_logs.MetricFilter` | `IAMPolicyChange`etc.      | Delete                  | -                          |
| `aws_cloudwatch.Alarm`  | `IAMPolicyChangeAlarm`etc. | Delete                  | -                          |

#### BLEATrailStack

| Types of resources     | Logical ID           | Behavior when destroyed | The impact when re-created                                                                                                                                                |
| ---------------------- | -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_s3.Bucket`        | `ArchiveLogsBucket`  | Retain                  | -                                                                                                                                                                         |
| `aws_s3.Bucket`        | `CloudTrailBucket`   | Retain                  | **You need two datasources for Athena to invoke a query.<br />Because the buckets are different before and after migration.**                                             |
| `aws_kms.Key`          | `CloudTrailKey`      | Retain                  | **You need to keep existing `Key` to encrypt/decrypt exsiting resources.**                                                                                                |
| `aws_logs.LogGroup`    | `CloudTrailLogGroup` | Retain                  | **You need to switch the `LogGroup` to search Trail logs before and after migration.<br />Because `LogGroup` that are before migration is existing in your environment.** |
| `aws_cloudtrail.Trail` | `CloudTrail`         | Delete                  | -                                                                                                                                                                         |

### Stacks are given by Standalone ver. only

#### BLEAConfigCtGuardrailStack

| Types of resources | Logical ID   | Behavior when destroyed | The impact when re-created |
| ------------------ | ------------ | ----------------------- | -------------------------- |
| `CfnInclude`       | `ConfigCtGr` | Delete                  | -                          |

#### BLEAConfigStack

| Types of resources                    | Logical ID              | Behavior when destroyed | The impact when re-created                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam.Role`                        | `ConfigRole`            | Delete                  | -                                                                                                                                                                                                                                                                                                                                           |
| `aws_config.CfnConfigurationRecorder` | `ConfigRecorder`        | Delete                  | **If you delete `Config Recorder`, the configuration information that was previously recorded is not deleted.<br />And you can access this after enabling `Config Recorder`<br />Ref:[delete-configuration-recorder](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/configservice/delete-configuration-recorder.html)** |
| `aws_s3.Bucket`                       | `ConfigBucket`          | Retain                  | **You need two datasources for Athena to invoke a query.<br />Because the buckets are different before and after migration.**                                                                                                                                                                                                               |
| `aws_config.CfnDeliveryChannel`       | `ConfigDeliveryChannel` | Delete                  | -                                                                                                                                                                                                                                                                                                                                           |

#### BLEAGuarddutyStack

| Types of resources          | Logical ID          | Behavior when destroyed | The impact when re-created |
| --------------------------- | ------------------- | ----------------------- | -------------------------- |
| `aws_guardduty.CfnDetector` | `GuardDutyDetector` | Delete                  | -                          |

#### BLEASecurityHubStack

| Types of resources             | Logical ID           | Behavior when destroyed | The impact when re-created                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aws_iam.CfnServiceLinkedRole` | `RoleForSecurityHub` | Delete                  | -                                                                                                                                                                                                                                                                                                                                    |
| `aws_securityhub.CfnHub`       | `SecurityHub`        | Delete                  | **The existing detection results will be deleted after 90 days when Security Hub was disabled.<br />So, the migration process need to be completed during 90 days from when Security Hub was disabled.<br />Ref：[Disabling Security Hub](https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-disable.html)** |

## How to migrate

1. Destroy all BLEAv2's stacks that you use
   - In terminal, please run `npx aws-cdk destroy --all -c environment={environment name} --profile {profile}` when you keep the BLEAv2's source code in your directory.
   - In AWS management console, please go to CloudFormation's console, destroy all BLEAv2's stacks.
2. Update BLEAv2 source code to BLEAv3
   - Pull BLEAv3 source code to your directory from GitHub OR merge BLEAv3 source code to your directory manually.
   - When you update source code, you have to copy parameters from `cdk.json` to `parameter.ts`. Please refer to [4-1. Set deployment parameters](../README.md#4-1-set-deployment-parameters)
3. Deploy BLEAv3
   - Please refer to [4-2. Deploy a governance base](../README.md#4-2-deploy-a-governance-base), and deploy BLEAv3 to your environment.
   - If there are no errors, migration is complete.
