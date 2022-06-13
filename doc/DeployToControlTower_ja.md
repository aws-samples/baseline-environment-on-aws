# Deploy to ControlTower environment

[In English](DeployToControlTower.md) | [リポジトリの README に戻る](../README_ja.md)

ここでは ControlTower 管理下のアカウントに BLEA を導入する手順について記述します。

## デプロイの流れ

デプロイするステップは以下の通りです。デプロイするだけの場合ビルド環境の構築は必ずしも必要ありませんが、コードの変更を容易に行うため、エディタも含めた開発環境を用意することをお勧めします。

### 前提条件

#### a. ランタイム

- ランタイム等の前提条件は Standalone 版と同様です。[README](../README_ja.md) をご覧ください
- AWS SSO を使うための前提条件
  - `aws2-wrap` を使用するため、 [Python3](https://www.python.org/) (>= `3.8`) が必要です。
  - AWS SSO との連携のため [AWS CLI version2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)が必要です。

#### b. 開発環境

CDK コードを安全に編集するため、本格的な開発を行わない場合であっても開発環境のセットアップを推奨します。以下に VisualStudioCode のセットアップ手順を示します。

- [手順]: [VisualStudioCode のセットアップ手順](HowTo_ja.md#VisualStudioCode-のセットアップ)

### ControlTower 配下への導入手順

ControlTower の配下にマルチアカウント版のガバナンスベースを導入して、ゲストシステムとしてサンプルアプリケーションを導入する手順を例にとって解説します。ここで`MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

1. ControlTower およびセキュリティサービスのセットアップ(MC)

2. デプロイ対象のゲストアカウントを ControlTower で作成する(MC)

3. 依存パッケージのインストールとコードのビルド(Local)

4. AWS SSO に合わせて AWS CLI の認証情報を設定する(Local)

5. Audit アカウントに通知用のベースラインを設定する(Local)

6. ゲストアカウント用ガバナンスベースをデプロイする(Local)

7. ゲストアプリケーションサンプルをデプロイする(Local)

## 導入手順

### 1. ControlTower およびセキュリティサービスのセットアップ(MC)

ControlTower を利用することで、ガバナンスベースの一部の機能は自動的に設定されます。ControlTower が対応していないセキュリティサービスは Organizations に対して一括有効化を行うことで、以後新しいアカウントが作られると自動的に設定されるようになります。

ここでは ControlTower をセットアップし、Organizations 全体に対して SecurityHub, GuardDuty, Inspector そして IAM Access Analyzer を有効化する手順を示します。これらの委任アカウントとして Audit アカウントを指定します。

#### 1-1. ControlTower のセットアップ

ControlTower をセットアップします。
See: [https://docs.aws.amazon.com/controltower/latest/userguide/setting-up.html]

#### 1-2. SecurityHub のセットアップ

- [https://docs.aws.amazon.com/securityhub/latest/userguide/designate-orgs-admin-account.html]
- [https://docs.aws.amazon.com/securityhub/latest/userguide/accounts-orgs-auto-enable.html]

#### 1-3. GuardDuty のセットアップ

- [https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_organizations.html]

#### 1-4. Inspector のセットアップ

委任された管理者権限の指定
- [https://docs.aws.amazon.com/ja_jp/inspector/latest/user/designating-admin.html]

メンバーアカウントでの有効化
- [https://docs.aws.amazon.com/inspector/latest/user/adding-member-accounts.html]

#### 1-5. IAM Access Analyzer のセットアップ

- [https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-settings.html#access-analyzer-delegated-administrator]

#### 1-6. Trusted Advisor のセットアップ

- [https://docs.aws.amazon.com/awssupport/latest/user/organizational-view.html]

### 2. デプロイ対象のゲストアカウントを ControlTower で作成する(MC)

#### 2-1. ゲストアカウントを作成する

ControlTower を使って新しいアカウント（ゲストアカウント）を作成します。

> See: [https://docs.aws.amazon.com/controltower/latest/userguide/account-factory.html#quick-account-provisioning]

#### 2-2. AWS Chatbot の事前準備として Slack workspaces の設定を行う

ゲストアカウントにおける、セキュリティイベントおよびモニタリングイベント通知のために Slack 連携用の設定を行います。セキュリティ通知のためのチャネル、システム監視通知のためのチャネルを Slack に作成し、以下の手順に従って Chatbot の設定を行います。設定が終わったら後の設定のため、ワークスペースの ID（1 つ）、通知先のチャネルの ID（2 つ）をメモしておきます。

- [手順] [AWSChatbot 用に Slack を設定する](HowTo_ja.md#AWSChatbot-用に-Slack-を設定する)

### 3. 依存パッケージのインストールとコードのビルド(Local)

#### 3-1. リポジトリの取得

```sh
git clone https://github.com/aws-samples/baseline-environment-on-aws.git
cd baseline-environment-on-aws
```

#### 3-2. 依存する NPM パッケージのインストール

```sh
# install dependencies
npm ci
```

#### 3-3. git-secrets のセットアップ

Git に Commit する際に Linter, Formatter, git-secrets によるチェックを行うための Hook を登録します。以下の手順に従ってセットアップしてください。デプロイするだけの場合は必須ではありませんが、よりセキュアに開発するためにセットアップを推奨します。

- [手順]: [Git の pre-commit hook のセットアップ](HowTo_ja.md#Git-の-pre-commit-hook-のセットアップ)

### 4. AWS SSO に合わせて AWS CLI の認証情報を設定する(Local)

恒久的な認証情報も利用可能ですが、ControlTower 環境では AWS SSO の利用を推奨します。AWS SSO によって、マネジメントコンソールへのログインおよび SSO 認証による AWS CLI の実行が可能です。

#### 4-1. AWS CLI のバージョンを確認する

AWS CLI - AWS SSO 統合を使うためには、AWS CLIv2 を使う必要があります。

- See: [https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html]

次のように CLI のバージョンを確認します:

```sh
aws --version
```

出力結果がバージョン 2 以上であることを確認します

```sh
aws-cli/2.3.0 Python/3.8.8 Darwin/20.6.0 exe/x86_64 prompt/off
```

#### 4-2. aws2-wrap を導入する

AWS CLI - AWS SSO 統合を CDK から使用するため、オープンソースのツールである aws2-wrap ([https://github.com/linaro-its/aws2-wrap]) を CDK を実行する環境にインストールします

```sh
pip3 install aws2-wrap
```

#### 4-3. Audit アカウントデプロイ用の AWS CLI プロファイルを設定する

次に、Control Tower の Audit アカウントにデプロイするための CLI プロファイルを設定します。ここではマネジメントアカウントの ID を `1111111111111`, Audit アカウントの ID を `222222222222` としています。

~/.aws/config

```text
# for Management Account Login
[profile ct-management-sso]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 1111111111111
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1

# Accessing with AWSControlTowerExecution Role on Audit Account
[profile ct-audit-exec-role]
role_arn = arn:aws:iam::222222222222:role/AWSControlTowerExecution
source_profile = ct-management-sso
region = ap-northeast-1

# for CDK access to ct-audit-exec-role
[profile ct-audit-exec]
credential_process = aws2-wrap --process --profile ct-audit-exec-role
region = ap-northeast-1
```

> NOTE:
>
> ControlTower の仕様により、Audit アカウントにデプロイするためには、まずマネジメントアカウントの `AWSAdministratorAccess` ロールでログインし、Audit アカウントの`AWSControlTowerExecution`ロールにスイッチして処理を実行する必要があります。
>
> `ct-management-sso`プロファイルで SSO ログインすることで、`ct-audit-exec-role`プロファイルを使って Audit アカウント上での操作が可能です。これに CDK からアクセスするため、ラッピングされたプロファイルである `ct-audit-exec` を使用します。

#### 4-4. ゲストアカウントデプロイ用の AWS CLI プロファイルを設定する

ゲストアカウントにデプロイするための AWS CLI プロファイルを設定します。ここではゲストアカウントの ID を`123456789012`としています。

~/.aws/config

```text
# for Guest Account Login
[profile ct-guest-sso]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 123456789012
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1

# for CDK access to ct-guest-sso
[profile ct-guest]
credential_process = aws2-wrap --process --profile ct-guest-sso
region = ap-northeast-1
```

> NOTE:
>
> `ct-guest-sso`プロファイルで ゲストアカウントに SSO ログインします。これに CDK からアクセスするため、ラッピングされたプロファイルである `ct-guest` を使用します。

#### 4-5. AWS SSO を使った CLI ログイン

次のコマンドで AWS SSO にログインします。ここでは`ct-guest-sso`プロファイルでログインする例を示します。

```sh
aws sso login --profile ct-guest-sso
```

このコマンドによって ブラウザが起動し、AWS SSO のログイン画面が表示されます。ゲストアカウントの管理者ユーザー名（メールアドレス）とパスワードを正しく入力すると画面がターミナルに戻り、 AWS CLI で ゲストアカウントでの作業が可能になります。

> Notes: `ct-guest`プロファイルは aws2-warp を経由した認証を行なっており、CDK を実行する場合に使用します。

### 5. Audit アカウントに通知用のベースラインを設定する(Local)

Audit アカウントには ControlTower が作成した、すべての AWS Config の変更通知が送られる SNS Topic があります。この内容を Slack に通知するようベースラインを設定します。
AWS Chatbot のセットアップのみマネジメントコンソールで行い、以後の作業はローカルで行います。

> NOTE:
>
> AWS Config の通知が不要である場合はこのベースラインは設定しなくても構いません。他のアカウントの挙動には影響しません。

> NOTE:
>
> Amazon Inspector の検出結果は Slack に通知されません。AWS Security Hub から結果を確認できます。


#### 5-1. AWS Chatbot 用の Slack セットアップ

Audit account にマネジメントコンソールでログインして、 AWS Chatbot に Slack Workspace をセットアップします。ここでは Aggregation 用の 1 つだけを作成します。以下の手順を参照してください。

- [手順] [AWSChatbot 用に Slack を設定する](HowTo_ja.md#AWSChatbot-用に-Slack-を設定する)

#### 5-2. デプロイ情報(Context)を設定する

ControlTower の Audit アカウント用ユースケースの CDK Context (cdk.json) にパラメータを指定します。設定ファイルはこちらです。デフォルトでは dev-audit という名前の context が設定されています。

```sh
usecases/base-ct-audit/cdk.json
```

usecases/base-ct-audit/cdk.json

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/blea-base-ct-audit.ts",
  "context": {
    "dev-audit": {
      "description": "Context samples for ControlTower Audit Account - Specific account & region",
      "env": {
        "account": "333333333333",
        "region": "ap-northeast-1"
      },
      "slackNotifier": {
        "workspaceId": "T8XXXXXXX",
        "channelIdAgg": "C01ZZZZZZZZ"
      }
    }
  }
}
```

この設定内容は以下の通りです。

| key                        | value                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| description                | 設定についてのコメント                                                                                            |
| envName                    | 環境名。これが各々のリソースタグに設定されます                                                                    |
| env.account                | デプロイ対象のアカウント ID。CLI の profile で指定するアカウントと一致している必要があります                      |
| env.region                 | デプロイ対象のリージョン。CLI の profile で指定するリージョンと一致している必要があります                         |
| slackNotifier.workspaceId  | AWS Chatbot に設定した Slack workspace の ID                                                                      |
| slackNotifier.channelIdAgg | AWS Chatbot に設定した Slack channel の ID。ControlTower 配下のアカウントの全ての AWS Config の変更が通知されます |

> NOTE: Context の使い方については以下の解説を参照してください
>
> - [cdk.context.json による個人環境の管理](HowTo_ja.md#cdkcontextjson-による個人環境の管理)
> - [アプリケーション内で Context にアクセスする仕組み](HowTo_ja.md#アプリケーション内で-Context-にアクセスする仕組み)

#### 5-3. Audit アカウント用のベースラインをデプロイ

以下のコマンドで AWS SSO を使ってマネジメントアカウントにログインします。

> Audit アカウントは マネジメントアカウントの `AWSControlTowerExecution` ロールでのみセットアップが可能です（ControlTower の仕様）

```sh
aws sso login --profile ct-management-sso
```

Audit アカウントに CDK 用バケットをブートストラップします(初回のみ)

```sh
cd usecases/base-ct-audit
npx cdk bootstrap -c environment=dev-audit --profile ct-audit-exec
```

Audit アカウントにガバナンスベースをデプロイします

```sh
cd usecases/base-ct-audit
npx cdk deploy --all -c environment=dev-audit --profile ct-audit-exec
```

以上で、この ControlTower 管理下にあるアカウントのすべての AWS Config 変更イベントが通知されるようになります。

> NOTE:
>
> - ここでは BLEA 環境にインストールしたローカルの cdk を利用するため、`npx`を使用しています。直接`cdk`からコマンドを始めた場合は、グローバルインストールされた cdk が利用されます。
> - cdk コマンドを利用するときに便利なオプションがあります。[デプロイ時の承認をスキップしロールバックさせない](HowTo_ja.md#デプロイ時の承認をスキップしロールバックさせない)を参照してください。

### 6. ゲストアカウント用ガバナンスベースをデプロイする(Local)

#### 6-1. デプロイ情報(Context)を設定する

デプロイのため CDK Context (cdk.json) にパラメータを指定する必要があります。 ControlTower 版のゲストアカウント ガバナンスベースの設定ファイルはこちらです。

```sh
usecases/base-ct-guest/cdk.json
```

このサンプルは `dev`と`staging` という Context を定義する例です。同様の設定を検証、本番アカウントにもデプロイできるようにするには、`staging`や`prod`といった Context を用意します。

> NOTE:
>
> デプロイ対象のアカウントを明示的に指定したい場合は`env`を指定してください。これによって CLI Profile で指定するアカウント-リージョンと、`env`で指定するものが一致していないとデプロイできなくなります。アカウントに設定したパラメータを確実に管理し、誤ったアカウントにデプロイすることを防ぐことができます。できるだけ`env`も指定することをお勧めします。

usecases/base-ct-guest/cdk.json

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/blea-base-sa.ts",
  "context": {
    "dev": {
      "description": "Context samples for Dev - Anonymous account & region",
      "envName": "Development",
      "securityNotifyEmail": "notify-security@example.com",
      "slackNotifier": {
        "workspaceId": "T8XXXXXXX",
        "channelIdSec": "C00XXXXXXXX"
      }
    },
    "stage": {
      "description": "Context samples for Staging - Specific account & region  ",
      "env": {
        "account": "111111111111",
        "region": "ap-northeast-1"
      },
      "envName": "Staging",
      "securityNotifyEmail": "notify-security@example.com",
      "slackNotifier": {
        "workspaceId": "T8XXXXXXX",
        "channelIdSec": "C01XXXXXXXX"
      }
    }
  }
}
```

この設定内容は以下の通りです。

| key                        | value                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| description                | 設定についてのコメント                                                                       |
| env.account                | デプロイ対象のアカウント ID。CLI の profile で指定するアカウントと一致している必要があります |
| env.region                 | デプロイ対象のリージョン。CLI の profile で指定するリージョンと一致している必要があります    |
| envName                    | 環境名。これが各々のリソースタグに設定されます                                               |
| securityNotifyEmail        | セキュリティに関する通知が送られるメールアドレス。内容は Slack と同様です                    |
| slackNotifier.workspaceId  | AWS Chatbot に設定した Slack workspace の ID                                                 |
| slackNotifier.channelIdSec | AWS Chatbot に設定した Slack channel の ID。セキュリティに関する通知が行われます             |

#### 6-2. ゲストアカウントにガバナンスベースデプロイする

AWS SSO を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

CDK 用バケットをブートストラップします(初回のみ)。

```sh
cd usecases/base-ct-guest
npx cdk bootstrap -c environment=dev --profile ct-guest
```

> NOTE:
>
> - ここでは BLEA 環境にインストールしたローカルの cdk を利用するため、`npx`を使用しています。直接`cdk`からコマンドを始めた場合は、グローバルインストールされた cdk が利用されます。
> - cdk コマンドを利用するときに便利なオプションがあります。[デプロイ時の承認をスキップしロールバックさせない](HowTo_ja.md#デプロイ時の承認をスキップしロールバックさせない)を参照してください。

ゲストアカウントのガバナンスベースをデプロイします。

```sh
cd usecases/base-ct-guest
npx cdk deploy --all -c environment=dev --profile ct-guest
```

これによって以下の機能がセットアップされます

- デフォルトセキュリティグループの閉塞 （逸脱した場合自動修復）
- AWS Health イベントの通知
- セキュリティに影響する変更操作の通知（一部）
- Slack によるセキュリティイベントの通知

Standalone 版でセットアップされていた以下の内容は ControlTower およびセキュリティサービスの Organizations 対応により設定されます。

- CloudTrail による API のロギング
- AWS Config による構成変更の記録
- Inspector による脆弱性の検出
- GuardDuty による異常なふるまいの検知
- SecurityHub によるベストプラクティスからの逸脱検知 (AWS Foundational Security Best Practice, CIS benchmark)

#### 6-3. (オプション) 他のベースラインセットアップを手動でセットアップする

ガバナンスベースでセットアップする他に
AWS はいくつかの運用上のベースラインサービスを提供しています。必要に応じてこれらのサービスのセットアップを行なってください。

##### a. Inspector を有効化

Inspector は、ワークロードをスキャンして、脆弱性を管理します。EC2 とECR を継続的にスキャンすることで、ソフトウェアの脆弱性や意図しないネットワークのエクスポージャーを検出します。検出された脆弱性は、算出されたリスクスコアに基づき優先順位づけされて表示されるため、可視性高く結果を取得できます。また、Scurity Hub とは自動で統合され、一元的に検出結果を確認できます。

セットアップ手順：[https://docs.aws.amazon.com/inspector/latest/user/getting_started_tutorial.html]

##### b. EC2 管理のため AWS Systems Manager Quick Setup を実施する

EC2 を利用する場合は SystemsManager を利用して管理することをお勧めします。AWS Systems Manager Quick Setup を使うことで、EC2 の管理に必要な基本的なセットアップを自動化できます。
セットアップ手順: [https://docs.aws.amazon.com/systems-manager/latest/userguide/quick-setup-host-management.html]

Quick Setup は以下の機能を提供します:

- Systems Manager で必要となる AWS Identity and Access Management (IAM) インスタンスプロファイルロールの設定
- SSM Agent の隔週自動アップデート
- 30 分ごとのインベントリメタデータの収集
- インスタンスのパッチ不足を検出するための日次スキャン
- 初回のみの、Amazon CloudWatch agent のインストールと設定
- CloudWatch agent の月次自動アップデート

##### c. Trusted Advisor の検知結果レポート

TrustedAdvisor は AWS のベストプラクティスをフォローするためのアドバイスを提供します。レポート内容を定期的にメールで受け取ることが可能です。詳細は下記ドキュメントを参照してください。

- See: [https://docs.aws.amazon.com/awssupport/latest/user/get-started-with-aws-trusted-advisor.html#preferences-trusted-advisor-console]

### 7. ゲストアプリケーションサンプルをデプロイする(Local)

ガバナンスベースが設定された後は Standalone 版も ControlTower 版も同じ手順で同じゲストアプリケーションサンプルをデプロイできます。

ゲストアカウントに SSO で認証している状態からデプロイメントの手順を示します。

#### 7-1. ゲストアプリケーションの Context を設定する

Standalone 版と同じ手順で Context を設定します。

#### 7-2. ゲストアプリケーションをデプロイする

（ログインしていない場合）AWS SSO を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

ゲストアプリケーションをデプロイします。

```sh
cd usecases/guest-webapp-sample
npx cdk deploy --all -c environment=dev --profile ct-guest
```

以上で単一アカウントに対するベースラインおよびサンプルアプリケーションのデプロイが完了します。

> NOTE:
>
> Aurora を含めた全てのリソースをデプロイ完了するまでには 30 分程度かかります。一部のリソースだけをデプロイしたい場合は対象のスタック名を明示的に指定してください。スタック名はアプリケーションコード(ここでは bin/blea-guest-ecsapp-sample.ts)の中で`${pjPrefix}-ECSApp`のように表現されています。
>
> ```sh
> cd usecases/guest-webapp-sample
> npx cdk deploy "BLEA-ECSApp" --app "npx ts-node --prefer-ts-exts bin/blea-guest-asgapp-sample.ts" -c environment=dev --profile prof_dev
> ```
>
> NOTE:
> guest-webapp-sample は bin ディレクトリ配下に複数のバリエーションを用意しています。デフォルトでは cdk.json の `app` に指定されたアプリケーション(blea-guest-ecsapp-sample.ts)がデプロイされます。 別のアプリケーションをデプロイしたい場合は、以下のように cdk の引数で明示的に `--app` を指定することで対応可能です。同一ユースケース内であれば cdk.json の Context はいずれも同じ内容で動作します。
>
> ```sh
> cd usecases/guest-webapp-sample
> npx cdk deploy --all --app "npx ts-node --prefer-ts-exts bin/blea-guest-asgapp-sample.ts" -c environment=dev --profile prof_dev
> ```

#### 7-3. 独自のアプリケーションを開発する

以後はこのサンプルコードを起点にして、自分のユースケースに合わせたアプリケーションを開発していくことになります。一般的な開発に必要な情報を示します。

- [通常の開発の流れ](HowTo_ja.md#通常の開発の流れ)
- [依存パッケージの最新化](HowTo_ja.md#依存パッケージの最新化)

#### 7-4. セキュリティ指摘事項の修復

ガバナンスベースをデプロイした後でも、Security Hub のベンチマークレポートで 重要度が CRITICAL あるいは HIGH のレベルでレポートされる検出項目があります。これらに対しては手動で対応が必要です。必要に応じて修復(Remediation)を実施してください。

- [セキュリティ指摘事項の修復](HowTo_ja.md#セキュリティ指摘事項の修復)
