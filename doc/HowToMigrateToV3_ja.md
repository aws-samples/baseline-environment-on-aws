# v3 へのマイグレーションガイド

v2 から v3 への変更点の概要については、[v3 のリリースノート](https://github.com/aws-samples/baseline-environment-on-aws/releases/tag/v3.0.0)を参照ください

## 概要

v3 ではガバナンスベースの設計方針・設定には変更がありませんが、スタック構成が変更されました。これまで各ユースケースが複数のスタックによって構成されていましたが、v3 ではそれぞれ 1 スタック（マルチリージョン構成など、必要な場合は複数スタック）構成になります。このため、スタックの再作成が必要となります。

AWS CloudTrail や AWS Config、AWS Security Hub などのログや検出結果を保持するサービスの取り扱いに考慮が必要です。

## v2 の Stack 構成と生成されるリソース、再作成時の影響

※再作成時の影響が「-」のものは、特に影響がないことを意味します。そのため、v3 デプロイ時にリソース作成が成功すれば問題ありません。

### Standalone 版/マルチアカウント版で提供される Stack

#### BLEAChatbotStack

| リソースの種類                             | 論理 ID          | Destroy 時の挙動 | 再作成時の影響 |
| ------------------------------------------ | ---------------- | ---------------- | -------------- |
| `aws_iam.Role`                             | `ChatbotRole`    | 削除される       | -              |
| `aws_chatbot.CfnSlackChannelConfiguration` | `ChatbotChannel` | 削除される       | -              |

#### BLEAConfigRulesStack

| リソースの種類                           | 論理 ID                              | Destroy 時の挙動 | 再作成時の影響 |
| ---------------------------------------- | ------------------------------------ | ---------------- | -------------- |
| `aws_config.ManagedRule`                 | `BLEARuleDefaultSecurityGroupClosed` | 削除される       | -              |
| `aws_iam.Role`                           | `RemoveSecGroupRemediationRole`      | 削除される       | -              |
| `aws_config.CfnRemediationConfiguration` | `RmDefaultSg`                        | 削除される       | -              |

#### BLEAIamStack

| リソースの種類          | 論理 ID              | Destroy 時の挙動 | 再作成時の影響 |
| ----------------------- | -------------------- | ---------------- | -------------- |
| `aws_iam.ManagedP○licy` | `SysAdminPolicy`など | 削除される       | -              |
| `aws_iam.Role`          | `SysAdminRole`など   | 削除される       | -              |
| `aws_iam.Group`         | `SysAdminGroup`など  | 削除される       | -              |

#### BLEASecurityAlarmStack

| リソースの種類          | 論理 ID                    | Destroy 時の挙動 | 再作成時の影響 |
| ----------------------- | -------------------------- | ---------------- | -------------- |
| `aws_sns.Topic`         | `SecurityAlarmTopic`       | 削除される       | -              |
| `aws_events.Rule`       | `BLEARuleConfigRules`など  | 削除される       | -              |
| `aws_logs.MetricFilter` | `IAMPolicyChange`など      | 削除される       | -              |
| `aws_cloudwatch.Alarm`  | `IAMPolicyChangeAlarm`など | 削除される       | -              |

#### BLEATrailStack

| リソースの種類         | 論理 ID              | Destroy 時の挙動 | 再作成時の影響                                                                                                                                                                                              |
| ---------------------- | -------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_s3.Bucket`        | `ArchiveLogsBucket`  | 保持される       | -                                                                                                                                                                                                           |
| `aws_s3.Bucket`        | `CloudTrailBucket`   | 保持される       | CloudTrail の証跡を保存する S3 バケットが新しく作成される。<br />v2 で記録していた証跡を Amazon Athena で検索する場合は、v3 をデプロイする前後で異なるデータソースへのクエリが必要がある。                  |
| `aws_kms.Key`          | `CloudTrailKey`      | 保持される       | v2 で作成した CloudTrail のイベントを記録する CloudWatch Logs の LogGroup を暗号・復号する CMK。<br />LogGroup は v2 時の記録を保持する必要がある場合、当該`key`も残す必要がある。                          |
| `aws_logs.LogGroup`    | `CloudTrailLogGroup` | 保持される       | CloudTrail のイベントを記録する CloudWatch Logs のロググループが新しく作成される。<br />CloudWatch Logs の機能でイベントのログを検索する場合は、v3 をデプロイする前後で異なるロググループへのクエリが必要。 |
| `aws_cloudtrail.Trail` | `CloudTrail`         | 削除される       | -                                                                                                                                                                                                           |

### Standalone 版のみで提供される Stack

#### BLEAConfigCtGuardrailStack

| リソースの種類 | 論理 ID      | Destroy 時の挙動 | 再作成時の影響 |
| -------------- | ------------ | ---------------- | -------------- |
| `CfnInclude`   | `ConfigCtGr` | 削除される       | -              |

#### BLEAConfigStack

| リソースの種類                        | 論理 ID                 | Destroy 時の挙動 | 再作成時の影響                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam.Role`                        | `ConfigRole`            | 削除される       | -                                                                                                                                                                                                                                                                                                                                        |
| `aws_config.CfnConfigurationRecorder` | `ConfigRecorder`        | 削除される       | Config Recorder を削除しても、構成記録自体は削除されないため、再作成で問題ない。<br />また、再度 Config Recorder を有効にすることで、過去の構成記録にアクセス可能となる。<br />参考:[delete-configuration-recorder](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/configservice/delete-configuration-recorder.html) |
| `aws_s3.Bucket`                       | `ConfigBucket`          | 保持される       | CloudTrail の証跡を保存する S3 バケットが新しく作成される。<br />v2 で記録していた証跡を Amazon Athena で検索する場合は、v3 をデプロイする前後で異なるデータソースへのクエリが必要がある。                                                                                                                                               |
| `aws_config.CfnDeliveryChannel`       | `ConfigDeliveryChannel` | 削除される       | -                                                                                                                                                                                                                                                                                                                                        |

#### BLEAGuarddutyStack

| リソースの種類              | 論理 ID             | Destroy 時の挙動 | 再作成時の影響 |
| --------------------------- | ------------------- | ---------------- | -------------- |
| `aws_guardduty.CfnDetector` | `GuardDutyDetector` | 削除される       | -              |

#### BLEASecurityHubStack

| リソースの種類                 | 論理 ID              | Destroy 時の挙動 | 再作成時の影響                                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aws_iam.CfnServiceLinkedRole` | `RoleForSecurityHub` | 削除される       | -                                                                                                                                                                                                                                                                                                      |
| `aws_securityhub.CfnHub`       | `SecurityHub`        | 削除される       | 再作成で問題ない。<br />ただし、SecurityHub を無効化した場合、90 日経過すると、既存の検出結果などが削除されるため、マイグレーションは 保持期間内に実施する必要がある。<br />参考：[Security Hub を無効にする](https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-disable.html) |

## マイグレーション手順

1. 利用しているユースケースで提供されている BLEAv2 の Stack を全て削除する
   - ターミナルからの場合、v2 のソースコードを維持した状態で、`npx aws-cdk destroy --all -c environment={環境識別子} --profile {profile}`を実行してください
   - マネジメントコンソールからの場合、CloudForamtion のコンソールへ遷移し、各 Stack を削除してください
2. BLEAv2 のソースコードを BLEAv3 へ更新する
   - github より、v3 のソースコードを pull するか、手動でマージしてください
   - ソースコードを更新する際に、v2 で利用していたパラメータを`cdk.json`から`parameter.ts`に忘れずにコピーしてください。詳しくは、[4-1. デプロイパラメータを設定する](../README_ja.md#4-1-デプロイパラメータを設定する)を参照ください
3. BLEAv3 をデプロイする
   - [4-2. ガバナンスベースをデプロイする](../README_ja.md#4-2-ガバナンスベースをデプロイする)を参照し、v3 をデプロイしてください
   - デプロイ後にエラーが発生していなければ成功です
