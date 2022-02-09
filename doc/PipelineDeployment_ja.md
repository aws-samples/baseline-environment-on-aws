# Baseline Envirionment on AWS デプロイパイプライン (GitHub 版)

[In English](PipelineDeployment.md) | [リポジトリの README に戻る](../../README_ja.md)

ユースケースサンプルとして提供されている CDK アプリケーションは GitHub に置かれた Baseline Environment on AWS (BLEA) CDK Pipelines によるパイプラインをデプロイします。

# デプロイの概要

## 1. パイプラインに必要な情報をセットアップする

![BLEA-Deploy-Setup](images/BLEA-DeployECS-01-Setup.png)

## 2. アプリケーションとパイプラインを同一アカウント内でデプロイする

![BLEA-Deploy-Tools](images/BLEA-DeployECS-02-Tool.png)

## 3. ローカル環境から開発環境用にアプリケーションスタックのコピーをデプロイする

![BLEA-Deploy-Dev](images/BLEA-DeployECS-03-Dev.png)

## 4. パイプラインから本番環境用のアカウントにデプロイする

![BLEA-Deploy-Prod](images/BLEA-DeployECS-04-Prod.png)

## 5. 複数のアカウントに対してパイプラインを使ってデプロイする

![BLEA-Deploy-Multi](images/BLEA-DeployECS-05-Multi.png)

# デプロイメント

## 前提条件

- パイプラインのデプロイ先のアカウント（以下、 Tools アカウント（ID: `222222222222`））およびリージョンで CDK をブートストラップ済みであること
- Tools アカウントに Administrator 権限でアクセスする認証情報を AWS CLI プロファイルとして設定済みであること
- BLEA リポジトリを自身の GitHub アカウントに Clone して Privatre なレポジトリにおいて開発作業を行なっていること（本サンプルにおいては、パイプラインによってデプロイする先のアカウント情報をファイルに記載する必要がありますので取り扱いにご注意ください）

## 1. OAuth で GitHub に接続する

1. Tools アカウントの AWS マネジメントコンソールにログインします
2. `CodePipeline` サービスを開きます
3. ナビゲーションペインの左下にある `Settings`=>`Connections` をクリックし、`Create connection` をクリックします
   ![BLEA-Deploy-1-Console](images/BLEA-Deploy-1-Console.png)
4. `GitHub` を選択して、`Connection name` を指定し、 `Connect to GitHub`をクリックします
   ![BLEA-Deploy-2-ChooseGitHub](images/BLEA-Deploy-2-ChooseGitHub.png)
5. "AWS Connector for GitHub"をインストールするため、`Install a new app` をクリックします
   ![BLEA-Deploy-3-CreateConnection](images/BLEA-Deploy-3-CreateConnection.png)
6. `Install AWS Connector for GitHub`の画面で、自身のリポジトリを選択し、`Install`をクリックします。この後画面がマネジメントコンソールに戻ります
   ![BLEA-Deploy-4-InstallApp](images/BLEA-Deploy-4-InstallApp.png)
7. `Connect to GitHub` のページで、 `Connect`をクリックします
   ![BLEA-Deploy-5-Connect](images/BLEA-Deploy-5-Connect.png)
8. 以上で Connection の ARN が画面に表示されます。形式は次のとおりです。 "arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" 後に使用するため、これをコピーします
   ![BLEA-Deploy-6-Finished](images/BLEA-Deploy-6-Finished.png)

## 2. CDK Pipelines プロジェクトを設定する

CodePipeline が自身の BLEA リポジトリの対象ブランチにアクセスできるようにするため、デプロイするアプリケーションの cdk.json ファイルを編集する。

```json
    "prod": {
      "env": {
        "account": "222222222222",
        "region": "ap-northeast-1"
      },
      "envName": "Production",

      ~~~~~ (Your App Context) ~~~~~

      "githubRepository": "ownername/repositoryname",
      "githubTargetBranch": "main",
      "codestarConnectionArn": "arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "prodEnv": {
            "account": "333333333333",
            "region": "ap-northeast-1"
        }
    },
```

- `prodpipeline`: このあと CDK コマンドラインで指定する環境名。このサンプルの場合は `-c environment=prodpipeline` のように指定することになる
- `env`: パイプラインと BLEA リソースのデプロイターゲットとなるアカウントとリージョン。 Tools アカウントと異なるアカウントにデプロイする場合、デプロイ先のアカウントであらかじめ Bootstrapping と、Tools アカウントの信頼を設定する必要がある。
- `envName`: 環境名の解説。デプロイ対象のリソースタグに付与される
- `githubRepository`: GitHub リポジトリの名前。自身のリポジトリ URL が 'https://github.com/ownername/repositoryname.git' である場合、`ownername/repositoryname` を指定する
- `githubTargetBranch`: ターゲットブランチ（このブランチにマージするとパイプラインが起動する）
- `codestarConnectionArn`: 先のセクションで取得した GitHub Connection の AR
- `toolEnv`: パイプラインスタックがデプロイされるアカウントに関する情報（以下、Tools アカウント（ID: `222222222222`））
- `prodEnv`: Tools アカウントにおけるパイプラインによってデプロイされるスタックのデプロイ先となるアカウント（以下、Prod アカウント（ID: `333333333333`））及びリージョン

### 2.a (Optional) クロスアカウントでデプロイを行う際、デプロイ先のアカウントのセットアップを行う

前提：Prod アカウントが Organization に登録されていて、SSO を用いて Credential を取得することができる。

```
[profile blea-pipeline-prod-sso]
sso_start_url = https://xxxxxxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 333333333333
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1

[profile blea-pipeline-prod-exec]
credential_process = aws2-wrap --process --profile blea-pipeline-prod-sso
region = ap-northeast-1
```

1. Prod アカウントに SSO でログインする

```sh
aws sso login --profile blea-pipeline-prod-sso
```

2. Prod アカウントのブートストラップを実施する

```sh
npx cdk bootstrap --profile blea-pipeline-prod-exec --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess --trust 222222222222 aws://333333333333/ap-northeast-1 -c environment=prod
```

参考情報：https://aws.amazon.com/jp/blogs/news/deploying-a-cdk-application-using-the-cdk-pipelines-modern-api/

## 3. CodePipeline project のデプロイ

現在 `guest-webapp-sample/blea-guest-ecsapp-sample.ts` をパイプライン `guest-webapp-sample/blea-guest-ecsapp-sample-pipeline.ts` からデプロイするサンプルが実装されている。これをデプロイする際には以下の手順を実施する。

### 3.1. ビルド対象のアプリケーションを `cdk.json` から確認する

`cdk build` あるいは `cdk deploy` されるファイルは `cdk.json` で指定するか、各コマンドを実行する際に `-a` オプションで指定することができます。例えば、現在実装されているサンプルパイプラインをデプロイしてみる場合、以下のように設定を書き換える必要があります。

#### **`usecases/guest-webapp-sample/cdk.json`**

```ts
{
  "app": "npx ts-node --prefer-ts-exts bin/blea-guest-ecsapp-sample-pipeline.ts",
  // ...
```

### 3.2. Synth コマンドの定義を確認する（pipeline Stack および、 `package.json` ）

CDK Pipelines では、Tools アカウントの CodeBuild において、 `cdk synth` コマンドを実施します。以下は、サンプル実装における Synth コマンドの実装例になります。

#### **`usecases/guest-webapp-sample/blea-ecsapp-sample-pipeline-stack.ts`**

```ts
        // ...
        commands: [
          'echo "node: $(node --version)" ',
          'echo "npm: $(npm --version)" ',
          'npm ci',
          'npm audit',
          'npm run lint',
          // move to repository to be deployed by this pipeline
          'cd usecases/guest-webapp-sample',
          'npm run build',
          'npm run test',
          // 'npx cdk context',
          'npm run synth:dev',
        ],
        // ...
```

`'npm run synth:dev',` の部分を実体に即した synth コマンドに書き換えるか、または以下のように `package.json` で定義される scripts にデプロイパイプラインに即した Synth コマンドを追記・上書きすることも可能です。

#### **`usecases/guest-webapp-sample/package.json`**

```json
  // ...
  "scripts": {
    "synth:dev": "npx cdk synth -c environment=dev && npx cdk synth --app \"npx ts-node --prefer-ts-exts bin/blea-guest-asgapp-sample.ts\" -c environment=dev && npx cdk synth --app \"npx ts-node --prefer-ts-exts bin/blea-guest-ec2app-sample.ts\" -c environment=dev && npx cdk synth --app \"npx ts-node --prefer-ts-exts bin/blea-guest-ecsapp-ssl-sample.ts\" -c environment=dev",
    "synth_dev_context_test": "npx cdk synth -c",
    "depcheck": "npx depcheck --ignore-dirs cdk.out",
    "build": "tsc --build",
    // ...
```

> Notes: synth コマンドを実行する際にオプションとして --profile を指定する必要はありません。CodeBuild は適切な権限( Tools アカウントの Administrator 権限)を保持しているためです。

### 3.3. 以下のコマンドによってパイプラインを Tools アカウントにデプロイする

以下のコマンドをローカル環境から実行することで、サンプルパイプラインを Tools アカウントにデプロイすることができます。

```sh
npm ci
cd usecase/guest-webapp-sample/
npm run build
npx cdk bootstrap -c environment=prodpipeline --profile your_profile_name  # If you haven't bootstrapped target account
# If you use cross account deployment, use following command instead of above
npx cdk bootstrap -c environment=dev --profile blea-multi-original-pipeline-guest-exec --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess aws://222222222222/ap-northeast-1

npx cdk deploy -c environment=prodpipeline --profile your_profile_name
```

## 4. BLEA のコードをアップデートおよびマージすることで、デプロイを実行する

パイプラインのデプロイが完了したら、BLEA のコードの変更を継続的にデプロイすることが可能になります。
BLEA のコードを変更して、commit し、対象ブランチへのマージを実行します。

GitHub に変更が push されたら、CodePipeline プロジェクトが起動され、その中で CodeBuild が実行されます。CodeBuild はご自身の GitHub リポジトリから BLEA ソースコードを取得し、CloudFormation テンプレートを synth した後に、デプロイします。

以上で BLEA のコードがパイプラインを通じてデプロイされました。

> Notes: CDK Pipelines では、 [SelfMutation](https://aws.amazon.com/jp/blogs/news/deploying-a-cdk-application-using-the-cdk-pipelines-modern-api/) という機能を使用することで、デプロイパイプラインもレポジトリの更新に応じて継続的にデプロイすることが可能です。これにより、技術的には Tools アカウントを介して定義されたスタックを全てデプロイすることが可能です。現在サンプルではこの機能が有効化されていませんが、pipeline Stack の `SelfMutation: false` と記述されているコードをコメントアウトすることで有効化できます。

<!-- # Appendix.1 - コンテナイメージのデプロイの流れ

ECS サンプルアプリケーションでは GitHub に push された Dockerfile を元に、GitHub Actions でコンテナイメージをビルドし、ECR に Push されることを想定しています。ここではコンテナイメージの一連のデプロイの流れを概説します。

## 1. 開発環境へのデプロイ

開発環境の ECR へコンテナイメージを push します。デプロイは CDK で実施します。

![BLEA-DeployECS-Dev](images/BLEA-DeployECS-Dev.png)

## 2. 本番環境へのコンテナイメージ Push

GitHub に Dockerfile を push します。GitHub Actions でビルドを実行し、本番環境の ECR へイメージを push します。

![BLEA-DeployECS-Build](images/BLEA-DeployECS-Build.png)

## 3. 本番環境の ECS へのデプロイ

BLEA コードをアップデート（最新のコンテナイメージを指すように変更する）して GitHub へ push します。ECS は ECR から最新のイメージを取得します。

![BLEA-DeployECS-Prod](images/BLEA-DeployECS-Prod.png) -->

# Appendix - 開発環境へのアプリケーションスタックのデプロイ

実際にシステムを CDK を用いて開発する際には、パイプラインを介さずにスタックをデプロイして検証サイクルを短くすることが必要になることがあります。そのような場合は開発環境用のアカウントに向けて、パイプラインではなくパイプラインによってデプロイされるスタックそのものをデプロイすることも可能です。

前提：以下に示されているような形で開発環境用に払い出されたアカウント（以下、Dev アカウント（ID: `xxxxxxxxxxxx`））が、Organization に登録されていて、SSO 経由で Credential を取得することができる。

```json
    "dev": {
      "env": {
        "account": "xxxxxxxxxxxx",
        "region": "ap-northeast-1"
      },
      "envName": "Development",

      ~~~~~ (Your App Context) ~~~~~

      "githubRepository": "ownername/repositoryname",
      "githubTargetBranch": "main",
      "codestarConnectionArn": "arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "prodEnv": {
            "account": "333333333333",
            "region": "ap-northeast-1"
        }
    },
```

```
[profile blea-pipeline-dev-sso]
sso_start_url = https://xxxxxxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = xxxxxxxxxxxx
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1

[profile blea-pipeline-dev-exec]
credential_process = aws2-wrap --process --profile blea-pipeline-dev-sso
region = ap-northeast-1
```

## 開発環境に対して Stage スタックを直接デプロイする

例えば、`BLEA-Dev-Stage` 中で定義されている `BLEA-ECSApp` を指定してデプロイしたい場合は以下のコマンドによって Dev アカウントにデプロイすることができます。

```
npx cdk deploy BLEA-Dev-Stage/BLEA-ECSApp -c environment=dev --profile=blea-pipeline-dev-exec
```

なお、以下のようなコマンドによってデプロイできるスタック (上記コマンドにおける`BLEA-Dev-Stage/BLEA-ECSApp`に相当するもの) の一覧を確認することができます

```
npx cdk ls -c environment=dev
```
