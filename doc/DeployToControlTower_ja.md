# Deploy to ControlTower environment

[In English](DeployToControlTower.md) | [リポジトリの README に戻る](../README_ja.md)

ここでは ControlTower 管理下のアカウントに BLEA を導入する手順について記述します。

## デプロイの流れ

デプロイするステップは以下の通りです。デプロイするだけの場合ビルド環境の構築は必ずしも必要ありませんが、コードの変更を容易に行うため、エディタも含めた開発環境を用意することをお勧めします。

### 前提条件

#### a. ランタイム

- ランタイム等の前提条件は Standalone 版と同様です。[README](../README_ja.md) をご覧ください
- AWS SSO を使うための前提条件
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

5. ゲストアカウント用ガバナンスベースをデプロイする(Local)

6. ゲストアプリケーションサンプルをデプロイする(Local)

## 導入手順

### 1. ControlTower およびセキュリティサービスのセットアップ(MC)

ControlTower を利用することで、ガバナンスベースの一部の機能は自動的に設定されます。ControlTower が対応していないセキュリティサービスは Organizations に対して一括有効化を行うことで、以後新しいアカウントが作られると自動的に設定されるようになります。

ここでは ControlTower をセットアップし、Organizations 全体に対して SecurityHub, GuardDuty, Inspector そして IAM Access Analyzer を有効化する手順を示します。これらの委任アカウントとして Audit アカウントを指定します。

#### 1-1. ControlTower のセットアップ

ControlTower をセットアップします。
See: [https://docs.aws.amazon.com/controltower/latest/userguide/setting-up.html]

> NOTE:
>
> AWS Control Tower では Landing Zone ver.3.0(LZ3.0) より、Organization Trail の設定が可能になりました。これは Control Tower の推奨設定であり、これによって Organizations 配下の CloudTrail ログは、ManagementAccount の AWS CloudWatch Logs に集約されます。
>
> ご参考：https://docs.aws.amazon.com/controltower/latest/userguide/2022-all.html#version-3.0
>
> BLEA はデフォルトで LZ3.0 以降の環境を想定していますが、ゲストアカウントで CloudTrail のログ監視を行うために Cloud Trail が必要であるため、Organization Trail に重複して 各ゲストアカウントにも CloudTrail を作成します。
>
> 以下の前提条件ではない環境へガバナンスベースを展開する場合は、[5-2. (必要に応じて)Control Tower landing zone の設定に合わせコードを修正する](<#5-2-(必要に応じて)Control-Tower-landing-zone-の設定に合わせコードを修正する>)をご覧ください
>
> 前提条件：
>
> - （ver. 2.x 以前でなく）Landing zone ver. 3.0 以降から Control Tower を利用し、Organization CloudTrail を有効化している

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

> NOTE:
>
> CDK v2.18.0 以降、AWS SSO のプロファイルを使って CDK を直接デプロイできるようになり、プロファイル内の認証プロセスでラッピングを使う必要がなくなりました。

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

#### 4-2. ゲストアカウントデプロイ用の AWS CLI プロファイルを設定する

ゲストアカウントにデプロイするための AWS CLI プロファイルを設定します。ここではゲストアカウントの ID を`123456789012`としています。

~/.aws/config

```text
# for Guest Account
[profile ct-guest]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 123456789012
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1
```

#### 4-3. AWS SSO を使った CLI ログイン

次のコマンドで AWS SSO にログインします。ここでは`ct-guest`プロファイルでログインする例を示します。

```sh
aws sso login --profile ct-guest
```

このコマンドによって ブラウザが起動し、AWS SSO のログイン画面が表示されます。ゲストアカウントの管理者ユーザー名（メールアドレス）とパスワードを正しく入力すると画面がターミナルに戻り、 AWS CLI で ゲストアカウントでの作業が可能になります。

### 5. ゲストアカウント用ガバナンスベースをデプロイする(Local)

#### 5-1. デプロイパラメータを設定する

デプロイの際に必要となる デプロイ先アカウントや通知先メールアドレスなど、各ユースケース固有のパラメータを指定する必要があります。 BLEA では `parameter.ts` というファイルでパラメータを管理します。書式は TypeScript です。

Control Tower 用ベースラインのパラメータはこちらで指定します。

```sh
usecases/blea-base-ct-guest/parameter.ts
```

このサンプルは `DevParameter` というパラメータセットを定義する例です。同様の設定を検証、本番アカウントにもデプロイできるようにするには、`StgParameter`や`ProdParameter`といったパラメータセットを定義し、App （こここでは `bin/blea-base-standalone.ts`）でそれぞれの環境のスタックを作成します。

usecases/blea-base-ct-guest/parameter.ts

```typescript
// Example for Development
export const DevParameter: MyParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};

// Example for Staging
export const StgParameter: MyParameter = {
  envName: 'Staging',
  securityNotifyEmail: 'notify-security@example.com',
  env: { account: '123456789012', region: 'ap-northeast-1' },
};
```

この設定内容は以下の通りです。

| key                 | value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| envName             | 環境名。これが各々のリソースタグに設定されます                                    |
| securityNotifyEmail | セキュリティに関する通知が送られるメールアドレス。内容は Slack と同様です         |
| env                 | デプロイ対象のアカウントとリージョン（指定しない場合は CLI の認証情報に従います） |

> NOTE:
>
> デプロイ対象のアカウントを明示的に指定したい場合は`env`を指定してください。これによって CLI Profile で指定するアカウント-リージョンと、`env`で指定するものが一致していないとデプロイできなくなります。アカウントに設定したパラメータを確実に管理し、誤ったアカウントにデプロイすることを防ぐことができます。できるだけ`env`も指定することをお勧めします。

> NOTE: BLEA v2.x までは Context (cdk.json) を使っていましたが、v3.0 以降は parameter.ts を使用します。

#### 5-2. ゲストアカウントにガバナンスベースデプロイする

AWS SSO を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest
```

CDK 用バケットをブートストラップします(初回のみ)。

```sh
cd usecases/blea-base-ct-guest
npx aws-cdk bootstrap --profile ct-guest
```

> NOTE:
>
> - ここでは BLEA 環境にインストールしたローカルの cdk を利用するため、`npx aws-cdk`を使用しています。直接`cdk`からコマンドを始めた場合は、グローバルインストールされた cdk が利用されます。
> - cdk コマンドを利用するときに便利なオプションがあります。[デプロイ時の承認をスキップしロールバックさせない](doc/HowTo_ja.md#デプロイ時の承認をスキップしロールバックさせない)を参照してください。

ゲストアカウントのガバナンスベースをデプロイします。

```sh
cd usecases/blea-base-ct-guest
npx aws-cdk deploy --all --profile ct-guest
```

これによって以下の機能がセットアップされます

- デフォルトセキュリティグループの閉塞 （逸脱した場合自動修復）
- AWS Health イベントの通知
- セキュリティに影響する変更操作の通知（一部）
- セキュリティイベントを通知する SNS トピック (SecurityAlarmTopic) と、メールへの送信

Standalone 版でセットアップされていた以下の内容は ControlTower およびセキュリティサービスの Organizations 対応により設定されます。

- CloudTrail による API のロギング
- AWS Config による構成変更の記録
- Inspector による脆弱性の検出
- GuardDuty による異常なふるまいの検知
- SecurityHub によるベストプラクティスからの逸脱検知 (AWS Foundational Security Best Practice, CIS benchmark)

#### 5-3. セキュリティイベントの Slack への通知

セキュリティイベントの検知と対応を集中管理するため、前のステップで作られた SecurityAlarmTopic のイベントを Slack に通知することをお勧めします。

すでに Slack Workspace を 3-2 で作成済みですので、以下の手順を参照して、SecurityAlarmTopic のイベントをご自身で作成した Slack チャネルに流すよう設定してください。セキュリティイベントのみを迅速に把握するため、このチャネルはこの用途に対してのみ使用し、他のアカウントやシステムモニタリング等と共用しないことをお勧めします。
Security AlarmTopic は実際には`DevBLEABaseCTGuest-SecurityDetectionSecurityAlarmTopic....`のような名前になっています。

Slack セットアップ手順: [https://docs.aws.amazon.com/ja_jp/chatbot/latest/adminguide/slack-setup.html]

#### 5-4. (オプション) 他のベースラインセットアップを手動でセットアップする

ガバナンスベースでセットアップする他に
AWS はいくつかの運用上のベースラインサービスを提供しています。必要に応じてこれらのサービスのセットアップを行なってください。

##### a. Amazon Inspector を有効化

Amazon Inspector は、ワークロードをスキャンして、脆弱性を管理します。EC2 と ECR を継続的にスキャンすることで、ソフトウェアの脆弱性や意図しないネットワークの露出を検出します。検出された脆弱性は、算出されたリスクスコアに基づき優先順位づけされて表示されるため、可視性高く結果を取得できます。また、Security Hub とは自動で統合され、一元的に検出結果を確認できます。

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

### 6. ゲストアプリケーションサンプルをデプロイする(Local)

ガバナンスベースが設定された後は Standalone 版も ControlTower 版も同じ手順で同じゲストアプリケーションサンプルをデプロイできます。

ゲストアカウントに SSO で認証している状態から、サーバーレス API アプリケーションサンプルをデプロイする手順を示します。

#### 6-1. ゲストアプリケーションのパラメータを設定する

Standalone 版と同じ手順でパラメータを設定します。

#### 7-2. ゲストアプリケーションをデプロイする

（ログインしていない場合）AWS SSO を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest
```

ゲストアプリケーションをデプロイします。

```sh
cd usecases/blea-guest-serverless-api-sample
npx aws-cdk deploy --all --profile ct-guest
```

以上でゲストアカウントに対するベースラインおよびサンプルアプリケーションのデプロイが完了します。

#### 7-3. 独自のアプリケーションを開発する

以後はこのサンプルコードを起点にして、自分のユースケースに合わせたアプリケーションを開発していくことになります。一般的な開発に必要な情報を示します。

- [通常の開発の流れ](HowTo_ja.md#通常の開発の流れ)
- [依存パッケージの最新化](HowTo_ja.md#依存パッケージの最新化)

#### 7-4. セキュリティ指摘事項の修復

ガバナンスベースをデプロイした後でも、Security Hub のベンチマークレポートで 重要度が CRITICAL あるいは HIGH のレベルでレポートされる検出項目があります。これらに対しては手動で対応が必要です。必要に応じて修復(Remediation)を実施してください。

- [セキュリティ指摘事項の修復](HowTo_ja.md#セキュリティ指摘事項の修復)
