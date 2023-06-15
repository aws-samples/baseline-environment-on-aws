# BLEA v3 へのマイグレーションガイド

BLEA v2 から v3 への変更点の概要については、[v3 のリリースノート](https://github.com/aws-samples/baseline-environment-on-aws/releases/tag/v3.0.0)を参照してください。

## 概要

BLEA v2 では各ユースケースが複数のスタックで構成されていましたが、v3 ではシングルスタック構成に変更されました（マルチリージョン構成のゲストシステムサンプルなど、必要な場合に限り複数スタックを使用）。このため、v3 へのマイグレーションにはデプロイ済みのスタックの削除と再作成が必要です。このマイグレーションガイドでは、AWS CloudTrail や AWS Config、AWS Security Hub のようにログや検出結果を保持するサービスへの影響を示します。

## BLEA v2 におけるスタック構成とリソース再作成の影響

※リソース再作成の影響が「-」のものは、リソース削除と再作成の影響がないことを意味します

### BLEAChatbotStack (スタンドアロン版, マルチアカウント版)

| リソースの種類                             | 論理 ID          | スタック削除時の挙動 | リソース再作成の影響 |
| ------------------------------------------ | ---------------- | -------------------- | -------------------- |
| `aws_iam.Role`                             | `ChatbotRole`    | 削除                 | -                    |
| `aws_chatbot.CfnSlackChannelConfiguration` | `ChatbotChannel` | 削除                 | -                    |

### BLEAConfigRulesStack (スタンドアロン版, マルチアカウント版)

| リソースの種類                           | 論理 ID                              | スタック削除時の挙動 | リソース再作成の影響 |
| ---------------------------------------- | ------------------------------------ | -------------------- | -------------------- |
| `aws_config.ManagedRule`                 | `BLEARuleDefaultSecurityGroupClosed` | 削除                 | -                    |
| `aws_iam.Role`                           | `RemoveSecGroupRemediationRole`      | 削除                 | -                    |
| `aws_config.CfnRemediationConfiguration` | `RmDefaultSg`                        | 削除                 | -                    |

### BLEAIamStack (スタンドアロン版, マルチアカウント版)

| リソースの種類          | 論理 ID              | スタック削除時の挙動 | リソース再作成の影響 |
| ----------------------- | -------------------- | -------------------- | -------------------- |
| `aws_iam.ManagedP○licy` | `SysAdminPolicy`など | 削除                 | -                    |
| `aws_iam.Role`          | `SysAdminRole`など   | 削除                 | -                    |
| `aws_iam.Group`         | `SysAdminGroup`など  | 削除                 | -                    |

### BLEASecurityAlarmStack (スタンドアロン版, マルチアカウント版)

| リソースの種類          | 論理 ID                    | スタック削除時の挙動 | リソース再作成の影響 |
| ----------------------- | -------------------------- | -------------------- | -------------------- |
| `aws_sns.Topic`         | `SecurityAlarmTopic`       | 削除                 | -                    |
| `aws_events.Rule`       | `BLEARuleConfigRules`など  | 削除                 | -                    |
| `aws_logs.MetricFilter` | `IAMPolicyChange`など      | 削除                 | -                    |
| `aws_cloudwatch.Alarm`  | `IAMPolicyChangeAlarm`など | 削除                 | -                    |

### BLEATrailStack (スタンドアロン版, マルチアカウント版)

| リソースの種類         | 論理 ID              | スタック削除時の挙動 | リソース再作成の影響                                                                                                                                                                       |
| ---------------------- | -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aws_s3.Bucket`        | `ArchiveLogsBucket`  | 保持                 | -                                                                                                                                                                                          |
| `aws_s3.Bucket`        | `CloudTrailBucket`   | 保持                 | CloudTrail の証跡を保存する S3 バケットが新しく作成される。<br />v2 で記録していた証跡を Amazon Athena で検索する場合は、v3 をデプロイする前後で異なるデータソースへのクエリが必要。       |
| `aws_kms.Key`          | `CloudTrailKey`      | 保持                 | CloudTrail のイベントを記録する CloudWatch Logs LogGroup を暗号化する CMK が新しく作成される。<br />v2 で記録していた LogGroup を保持する必要がある場合は以前の CMK を保持する必要がある。 |
| `aws_logs.LogGroup`    | `CloudTrailLogGroup` | 保持                 | CloudTrail のイベントを記録する CloudWatch Logs LogGroup が新しく作成される。<br />v2 で記録していた LogGroup を参照する場合は、v3 をデプロイする前後で異なる LogGroup へのクエリが必要。  |
| `aws_cloudtrail.Trail` | `CloudTrail`         | 削除                 | -                                                                                                                                                                                          |

### BLEAConfigCtGuardrailStack (スタンドアロン版)

| リソースの種類 | 論理 ID      | スタック削除時の挙動 | リソース再作成の影響 |
| -------------- | ------------ | -------------------- | -------------------- |
| `CfnInclude`   | `ConfigCtGr` | 削除                 | -                    |

### BLEAConfigStack (スタンドアロン版)

| リソースの種類                        | 論理 ID                 | スタック削除時の挙動 | リソース再作成の影響                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ----------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam.Role`                        | `ConfigRole`            | 削除                 | -                                                                                                                                                                                                                                                                                                                      |
| `aws_config.CfnConfigurationRecorder` | `ConfigRecorder`        | 削除                 | Config Recorder を削除しても構成記録は削除されないため、再作成の影響はない。<br />再度 Config Recorder を有効にすることで過去の構成記録にアクセス可能。<br />参考:[delete-configuration-recorder](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/configservice/delete-configuration-recorder.html) |
| `aws_s3.Bucket`                       | `ConfigBucket`          | 保持                 | AWS Config の構成記録を保存する S3 バケットが新しく作成される。<br />v2 で保存していた構成記録を Amazon Athena などで検索する場合は、v3 をデプロイする前後で異なるデータソースへのクエリが必要。                                                                                                                       |
| `aws_config.CfnDeliveryChannel`       | `ConfigDeliveryChannel` | 削除                 | -                                                                                                                                                                                                                                                                                                                      |

### BLEAGuarddutyStack (スタンドアロン版)

| リソースの種類              | 論理 ID             | スタック削除時の挙動 | リソース再作成の影響 |
| --------------------------- | ------------------- | -------------------- | -------------------- |
| `aws_guardduty.CfnDetector` | `GuardDutyDetector` | 削除                 | -                    |

### BLEASecurityHubStack (スタンドアロン版)

| リソースの種類                 | 論理 ID              | スタック削除時の挙動 | リソース再作成の影響                                                                                                                                                                                                                                                                                             |
| ------------------------------ | -------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam.CfnServiceLinkedRole` | `RoleForSecurityHub` | 削除                 | -                                                                                                                                                                                                                                                                                                                |
| `aws_securityhub.CfnHub`       | `SecurityHub`        | 削除                 | Security Hub リソース が再作成される。<br />Security Hub を無効化した場合、90 日経過すると既存の検出結果などが削除されるため、マイグレーションは保持期間内に実施する必要がある。<br />参考：[Security Hub を無効にする](https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-disable.html) |

## マイグレーション手順

1. 利用しているユースケースで提供されている BLEA v2 の Stack を全て削除する
   - ターミナルからの場合、v2 のソースコードを維持した状態で、`npx aws-cdk destroy --all -c environment={環境識別子} --profile {profile}`を実行
   - マネジメントコンソールからの場合、CloudForamtion のコンソールへ遷移し、各 Stack を削除
2. BLEA v2 のソースコードを BLEA v3 へ更新する
   - GitHub から v3 のソースコードを 取得してマージ
   - ソースコードを更新する際に、v2 で利用していたパラメータを`cdk.json`から`parameter.ts`に転記する。詳しくは、[4-1. デプロイパラメータを設定する](../README_ja.md#4-1-デプロイパラメータを設定する)を参照
3. BLEA v3 をデプロイする
   - [4-2. ガバナンスベースをデプロイする](../README_ja.md#4-2-ガバナンスベースをデプロイする)を参照し、v3 をデプロイ
   - デプロイ後にエラーが発生していなければ成功
