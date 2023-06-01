# v3 へのマイグレーションガイド

v2 から v3 への変更点の概要については、[v3 のリリースノート](https://github.com/aws-samples/baseline-environment-on-aws/releases/tag/v3.0.0)を参照ください

## 概要

v3 は上記のリリースノートにある通り、複数の Stack による構成から、シングル Stack 構成へ変更されました。

その結果、ガバナンスベースラインの設計方針・設定には変更がありませんが、リソースは再作成が必要になります。

AWS CloudTrail や AWS Config、AWS Security Hub といったログや検出結果といったデータを持つサービス群は、そのデータの取り扱いに考慮が必要です。
考慮が必要なサービスやデータについては、個別に記述していますので、参照ください。

## v2 の Stack 構成と生成されるリソース、再作成時の影響

### Standalone 版/マルチアカウント版で提供される Stack

#### BLEAChatbotStack

| リソースの種類                             | 論理 ID          | 再作成時の影響 |
| ------------------------------------------ | ---------------- | -------------- |
| `aws_iam.Role`                             | `ChatbotRole`    | -              |
| `aws_chatbot.CfnSlackChannelConfiguration` | `ChatbotChannel` | -              |

#### BLEAConfigRulesStack

| リソースの種類                           | 論理 ID                              | 再作成時の影響 |
| ---------------------------------------- | ------------------------------------ | -------------- |
| `aws_config.ManagedRule`                 | `BLEARuleDefaultSecurityGroupClosed` | -              |
| `aws_iam.Role`                           | `RemoveSecGroupRemediationRole`      | -              |
| `aws_config.CfnRemediationConfiguration` | `RmDefaultSg`                        | -              |

#### BLEAIamStack

| リソースの種類          | 論理 ID              | 再作成時の影響 |
| ----------------------- | -------------------- | -------------- |
| `aws_iam.ManagedP○licy` | `SysAdminPolicy`など | -              |
| `aws_iam.Role`          | `SysAdminRole`など   | -              |
| `aws_iam.Group`         | `SysAdminGroup`など  | -              |

#### BLEASecurityAlarmStack

| リソースの種類          | 論理 ID                    | 再作成時の影響 |
| ----------------------- | -------------------------- | -------------- |
| `aws_sns.Topic`         | `SecurityAlarmTopic`       | -              |
| `aws_events.Rule`       | `BLEARuleConfigRules`など  | -              |
| `aws_logs.MetricFilter` | `IAMPolicyChange`など      | -              |
| `aws_cloudwatch.Alarm`  | `IAMPolicyChangeAlarm`など | -              |

#### BLEATrailStack

| リソースの種類         | 論理 ID              | 再作成時の影響                                                                                                                                                                          |
| ---------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_s3.Bucket`        | `ArchiveLogsBucket`  | -                                                                                                                                                                                       |
| `aws_s3.Bucket`        | `CloudTrailBucket`   | 再作成で問題ないが、<br />**Athena でクエリを実行する際は、<br />マイグレーション前後で検索対象となる <br />Bucket が異なるため、<br />v2 用と v3 用の 2 つのデータソースが必要になる** |
| `aws_kms.Key`          | `CloudTrailKey`      | 再作成で問題ないが、<br />既存の暗号・復号対象リソースのため、<br />既存の`key`も残す必要がある                                                                                         |
| `aws_logs.LogGroup`    | `CloudTrailLogGroup` | 再作成で問題ないが、<br />**Trail のログを検索する際は、<br />マイグレーション前後で検索対象となる <br />LogGroup が異なるため、注意が必要**                                            |
| `aws_cloudtrail.Trail` | `CloudTrail`         | -                                                                                                                                                                                       |

### Standalone 版のみで提供される Stack

#### BLEAConfigCtGuardrailStack

| リソースの種類 | 論理 ID      | 再作成時の影響 |
| -------------- | ------------ | -------------- |
| `CfnInclude`   | `ConfigCtGr` | -              |

#### BLEAConfigStack

| リソースの種類                        | 論理 ID                 | 再作成時の影響                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam.Role`                        | `ConfigRole`            | -                                                                                                                                                                                                                                                                                                                                                          |
| `aws_config.CfnConfigurationRecorder` | `ConfigRecorder`        | Config Recorder を削除しても、<br />構成記録自体は削除されないため、<br />再作成で問題ない。<br />また、再度 Config Recorder を有効にすることで、<br />過去の構成記録にアクセス可能となる。<br />参考:[delete-configuration-recorder](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/configservice/delete-configuration-recorder.html) |
| `aws_s3.Bucket`                       | `ConfigBucket`          | 再作成で問題ない。<br />ただし、v2 時に作成された Bucket は<br />`DeletionPolicy`が`RETAIN`のため、<br />Stack が削除されてもリソースは残る。 <br /> **Athena でクエリを実行する際は、<br />マイグレーション前後で検索対象となる Bucket が異なるため、<br />v2 用と v3 用の 2 つのデータソースが必要になる**                                               |
| `aws_config.CfnDeliveryChannel`       | `ConfigDeliveryChannel` | -                                                                                                                                                                                                                                                                                                                                                          |

#### BLEAGuarddutyStack

| リソースの種類              | 論理 ID             | 再作成時の影響 |
| --------------------------- | ------------------- | -------------- |
| `aws_guardduty.CfnDetector` | `GuardDutyDetector` |                |

#### BLEASecurityHubStack

| リソースの種類                 | 論理 ID              | 再作成時の影響                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aws_iam.CfnServiceLinkedRole` | `RoleForSecurityHub` | -                                                                                                                                                                                                                                                                                                                  |
| `aws_securityhub.CfnHub`       | `SecurityHub`        | 再作成で問題ない。<br />ただし、SecurityHub を無効化した場合、<br />90 日経過すると、既存の検出結果などが削除されるため、<br />マイグレーションは 保持期間内に実施する必要がある。<br />参考：[Security Hub を無効にする](https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-disable.html) |

## マイグレーション手順

1. 利用しているユースケースで提供されている BLEAv2 の Stack を全て削除する
   - ターミナルからの場合、v2 のソースコードを維持した状態で、`npm run aws-cdk destroy --all -c environment={環境識別子} --profile {profile}`を実行してください
   - マネジメントコンソールからの場合、CloudForamtion のコンソールへ遷移し、各 Stack を削除してください
2. BLEAv2 のソースコードを BLEAv3 へ更新する
   - github より、v3 のソースコードを pull するか、手動でマージしてください
3. BLEAv3 をデプロイする
   - [4-2. ガバナンスベースをデプロイする](../README_ja.md#4-2-ガバナンスベースをデプロイする)を参照し、v3 をデプロイしてください
   - デプロイ後にエラーが発生していなければ成功です
