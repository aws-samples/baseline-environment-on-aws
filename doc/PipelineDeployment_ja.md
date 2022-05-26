# CDK Pipelines を使用して guest-webapp-sample をデプロイする

[In English](PipelineDeployment.md) | [リポジトリの README に戻る](../../README_ja.md)

CDK による CI/CD の一例として、このドキュメントでは [CDK pipelines](https://github.com/aws/aws-cdk/tree/master/packages/%40aws-cdk/pipelines) を用いてスタックをデプロイするためのサンプルコードの使用方法を示します。

CDK Pipelines は、AWS CodePipeline によって CDK アプリケーションの継続的なデプロイパイプラインを簡単にセットアップできる高レベルのコンストラクトライブラリです。CDK pipelines で迅速にパイプラインを構築することで、お客様はアプリケーション開発を簡素化し、より関心の高い部分に注力することができます。

現在 `guest-webapp-sample/bin/blea-guest-ecsapp-sample.ts` と同等の構成を `guest-webapp-sample/bin/blea-guest-ecsapp-sample-pipeline.ts` で Stage (CDK Pipelines におけるデプロイ単位を定義するサブクラス) として定義し、パイプラインからデプロイするサンプルが実装されています。このドキュメントではこのユースケースをもとに、実際にパイプラインによる継続的なデプロイを構築していきます。

事前に `guest-webapp-sample/bin/blea-guest-ecsapp-sample.ts` を別にデプロイしている場合、複数リソースに対する課金であったり、リソース名のコンフリクトに伴うパイプラインデプロイの失敗等が発生する可能性がありますのでご注意ください。

## デプロイの概要

### セットアップ（共通） - パイプラインに必要な情報を設定

![BLEA-Deploy-Setup](images/BLEA-DeployECS-01-Setup.png)

CodePipeline がソースコードを取得するために必要な設定を実施します。

### 構成パターン A：同一アカウント内でパイプラインとアプリケーションをデプロイする

![BLEA-Deploy-Tools](images/BLEA-DeployECS-02-Tool.png)

パイプラインとアプリケーションの両方を同一アカウント内にでデプロイすることができます。Git リポジトリに対する Push を CodePipeline が検知してそれをトリガーにアプリケーションがパイプラインによって更新されます。以降で示される手順のうち、必須のものを実施した場合にこちらの構成を検証することが可能です。

### 構成パターン B：パイプラインから別アカウントに対してアプリケーションをデプロイする

![BLEA-Deploy-Dev](images/BLEA-DeployECS-03-Dev.png)

パイプラインを持つアカウント（Tools アカウント）とは別のアカウントに対してアプリケーションをデプロイします。以降で示される手順のうち、Appendix A も含めて実施した場合にこちらの構成を検証することができます。

### 構成パターン C：パイプラインから複数のアカウントに対してアプリケーションをデプロイする

![BLEA-Deploy-Prod](images/BLEA-DeployECS-04-Prod.png)

複数アカウントにアプリケーションをデプロイする方法は複数ありますが、ここでは一例として、各アカウントごとにパイプラインを作成している例を示しています。この構成は、各アカウントごとに構成 ② で要求される作業を実施することで検証可能です。

### （Appendix）パイプライン経由ではなく直接アプリケーションをデプロイする

![BLEA-Deploy-Multi](images/BLEA-DeployECS-05-Multi.png)

パイプライン経由でなく、ローカル環境から直接アプリケーションをデプロイすることも可能です。本構成の手順は Appendix B にて示されている手順を実施することにより検証可能です。

## デプロイメント

### 前提条件

- パイプラインのデプロイ先のアカウント（以下、 Tools アカウント（ID: `222222222222`） または単にアカウント）およびリージョンで CDK をブートストラップ済みであること
- Tools アカウントに Administrator 権限でアクセスする認証情報（本ドキュメントでは `blea-pipeline-tool-exec` と記載）を AWS CLI プロファイルとして設定済みであること

  > Notes: Administrator 権限は CDK のブートストラップを行う際と、パイプラインをデプロイする際に必要な権限となります。セキュリティの観点から、パイプラインのデプロイが完了したら Administrator 権限を外すことが推奨されます（ [CDK Pipelines のドキュメント](https://docs.aws.amazon.com/cdk/api/v1/docs/pipelines-readme.html) より）。

### 1. AWS CodeStar Connections を使用して　 GitHub を接続する

はじめに、パイプラインによってデプロイを行う Git リポジトリに対する Connection を作成する必要があります。ただし、既に対象 Git リポジトリにアクセスできる Connection を作成済みの場合においては手順 1-7 をスキップすることが可能です。

1. Tools アカウントの AWS マネジメントコンソールにログインします
2. [CodePipeline] サービスを開きます
3. ナビゲーションペインの左下にある [Settings]=>[Connections] をクリックし、[Create Connection] をクリックします。

![BLEA-Deploy-1-Console](images/BLEA-Deploy-1-Console.png)

4. [GitHub] を選択して、[Connection name] を指定し、 [Connect to GitHub] をクリックします

![BLEA-Deploy-2-ChooseGitHub](images/BLEA-Deploy-2-ChooseGitHub.png)

5. "AWS Connector for GitHub"をインストールするため、[Install a new app] をクリックします

![BLEA-Deploy-3-CreateConnection](images/BLEA-Deploy-3-CreateConnection.png)

6. [Install AWS Connector for GitHub] の画面で、自身のリポジトリを選択し、[Install] をクリックします。この後画面がマネジメントコンソールに戻ります

![BLEA-Deploy-4-InstallApp](images/BLEA-Deploy-4-InstallApp.png)

7. [Connect to GitHub] のページで、 [Connect] をクリックします

![BLEA-Deploy-5-Connect](images/BLEA-Deploy-5-Connect.png)

8. 以上で Connection の ARN が画面に表示されます。形式は次のとおりです。 `arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 後に使用するため、これをコピーします

![BLEA-Deploy-6-Finished](images/BLEA-Deploy-6-Finished.png)

### 2. `cdk.json` に Connection の情報を設定する

デプロイするアプリケーションの `cdk.json` ファイル（今回の場合、`usecases/guest-webapp-sample/cdk.json`）を編集することで、CDK がコンテクスト情報を CodePipeline に引き渡せるように設定します。

```json
    "dev": {
      "envName": "Production",

      ~~~~~ (Your App Context) ~~~~~

      "repository": "ownername/repositoryname",
      "branch": "main",
      "connectionArn": "arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    },
```

- `dev`: このあと CDK コマンドラインで指定する環境名。このサンプルの場合は `-c environment=dev` のように指定することになる
- `repository`: GitHub リポジトリの名前。自身のリポジトリ URL が 'https://github.com/ownername/repositoryname.git' である場合、`ownername/repositoryname` を指定する
- `branch`: パイプラインが参照するブランチ名
- `connectionArn`: 先のセクションで取得した GitHub Connection の ARN

### 3. パイプラインをデプロイする

#### 3.1. ビルド対象のアプリケーションを `cdk.json` から確認する

`cdk synth` あるいは `cdk deploy` されるファイルは、 `cdk.json` で`app` において対象ファイルを指定するか、各コマンドを実行する際に `--app` オプションで `cdk.json` の `app` 設定値をオーバーライドすることで指定することができます。パイプラインを使って今後継続的にデプロイを行う場合、以下のように `cdk.json` の設定を書き換えることを推奨します。

##### **`usecases/guest-webapp-sample/cdk.json`**

```ts
{
  "app": "npx ts-node --prefer-ts-exts bin/blea-guest-ecsapp-sample-pipeline.ts",
  // ...
```

#### 3.2. Synth コマンドの定義を確認する（pipeline Stack および、 `package.json` ）

CDK Pipelines では、Tools アカウントの CodeBuild において、 `cdk synth` コマンドを実施します。以下は、サンプル実装における Synth コマンドの実装例になります。

##### **`usecases/guest-webapp-sample/pipeline/blea-ecsapp-sample-pipeline-stack.ts`**

```ts
        // ...
        commands: [
          'echo "node: $(node --version)" ',
          'echo "npm: $(npm --version)" ',
          'npm ci',
          'npm audit',
          'npm run lint',
          'cd usecases/guest-webapp-sample',
          'npm run build',
          'npm run test',
          'npm run synth:dev',
        ],
        // ...
```

`'npm run synth:dev',` の部分を実態に即した synth コマンドに書き換えるか、または以下のように `package.json` で定義される scripts にデプロイパイプラインに即した Synth コマンドを追記・上書きすることも可能です。

> Notes: ここで `package.json` を編集することができるのは、　`npm run` によって実行されるコマンドが当該ファイルの `scripts` において定義されているためです。

##### **`usecases/guest-webapp-sample/package.json`**

```json
  // ...
  "scripts": {
    "synth:dev": "npx cdk synth -c environment=dev && npx cdk synth --app \"npx ts-node --prefer-ts-exts bin/blea-guest-asgapp-sample.ts\" -c environment=dev && npx cdk synth --app \"npx ts-node --prefer-ts-exts bin/blea-guest-ec2app-sample.ts\" -c environment=dev && npx cdk synth --app \"npx ts-node --prefer-ts-exts bin/blea-guest-ecsapp-ssl-sample.ts\" -c environment=dev && npx cdk ls -c environment=dev",
    "synth_dev_context_test": "npx cdk synth -c",
    "depcheck": "npx depcheck --ignore-dirs cdk.out",
    "build": "tsc --build",
    // ...
```

> Notes: synth コマンドをパイプライン内部で実行する際は、実行する際にオプションとして --profile を指定する必要はありません。CodeBuild は適切な権限( Tools アカウントの Administrator 権限)を保持しているためです。
> ローカルで実行する場合は、 `npm run synth:dev -- --profile xxxxxx` のような形で Profile を指定することで実行することができます。

#### 3.3. アカウントをブートストラップし、パイプラインを Tools アカウントにデプロイする

以下のコマンドをローカル環境から実行することで、パイプラインを Tools アカウントにデプロイすることができます。

```sh
npm ci
cd usecase/guest-webapp-sample/
npm run build
npx cdk bootstrap -c environment=dev --profile blea-pipeline-tool-exec  # If you haven't bootstrapped target account

npx cdk deploy -c environment=dev --profile blea-pipeline-tool-exec
```

### 4. BLEA のコードを更新し変更を Push することで、デプロイを実行する

パイプラインのデプロイが完了したら、BLEA のコードの変更を継続的にデプロイすることが可能になります。
BLEA のコードを変更して、commit し、対象ブランチへの Push を実行します。

GitHub に変更が push されたら、CodePipeline が起動して Git リポジトリからソースコードを取得します。CodePipeline 内部では CodeBuild が実行されており、 Cloud Assembly を synth した後に、デプロイします。

以上でユースケース `guest-webapp-sample/bin/blea-guest-ecsapp-sample-pipeline.ts` の Stage で定義された CDK アプリケーションがパイプラインを通じてデプロイされました。

> Notes: CDK Pipelines では、 [SelfMutation](https://aws.amazon.com/jp/blogs/news/deploying-a-cdk-application-using-the-cdk-pipelines-modern-api/) という機能を使用することで、デプロイパイプラインもリポジトリの更新に応じて継続的にデプロイすることが可能です。これにより、Tools アカウントを介して定義されたスタックを全てデプロイすることが可能です。

---

## Appendix A - クロスアカウントに対するデプロイ

CDK Pipelines は、アカウント間にまたがるアプリケーションをデプロイするパイプラインを手軽に実現することが可能です。
本項目では、Tools アカウントから CDK アプリケーションをデプロイする先のアカウント（以下、Prod アカウント（ID： `333333333333` ））に対してクロスアカウントなアプリケーションのデプロイを実施する手順を示します。

### 前提条件

- Prod アカウントが Organization に登録されていて、SSO を用いて Credential を取得することができること
- パイプラインをデプロイする Git リポジトリがプライベートリポジトリとして管理され、第三者が `cdk.json` またはパイプラインのスタック等に記載されているアカウント情報にアクセスできないこと

  > Notes: 本サンプルでは、パイプラインがデプロイするスタックのデプロイ先となるアカウントの接続情報を記載する必要があるため、当該情報を管理する Git リポジトリは Private である必要があります。例えば GitHub 上で開発を行う場合、公開されている本リポジトリを Clone して Push することで Private なリポジトリを作成する必要があります。この際本リポジトリを Fork するとプライベートリポジトリとして管理することができないので、注意が必要です。

### コードの変更

1. CDK Pipelines の `crossAccountKeys` を `true` に設定して有効化する

##### **`usecases/guest-webapp-sample/pipeline/blea-ecsapp-sample-pipeline-stack.ts`**

```ts
    const pipeline = new pipelines.CodePipeline(this, `${id}-pipeline`, {
      // crossAccountKeys: true,
      synth: new pipelines.CodeBuildStep('SynthStep', {
        input: pipelines.CodePipelineSource.connection(props.repository, props.branch, {
```

> **NOTE** > `crossAccountKeys` を `true`　にすると、テスト時のアカウント情報に関する評価がより厳密になります。
> 具体的には、パイプラインスタックにおいて明示的に（環境情報を介さずに）アカウント情報を渡す必要があります。このためには `cdk.json` の設定値を介してアカウント情報を渡す、などといった手段が考えられます。

2. Pipeline がデプロイする Stage をインスタンスかする際に、デプロイ先のアカウント情報を　`env` に渡す。

##### **`usecases/guest-webapp-sample/bin/blea-guest-ecsapp-sample-pipeline.ts`**

```ts
new BLEAPipelineStack(app, `${pjPrefix}-Pipeline`, {
  repository: envVals['repository'],
  branch: envVals['branch'],
  connectionArn: envVals['connectionArn'],
  env: getProcEnv(),

  deployStage: new BLEAPipelineStage(app, `${pjPrefix}-Pipeline-Deployment`, {
    env: {
      account: envVals['prodEnv']['account'],
      region: envVals['prodEnv']['region'],
    }, // you can change deploy account by changing this value.
  }),
});
```

アカウント情報を記載する際は、`cdk.json` に接続情報を以下のような形で追記する必要があります。

```json
    "dev": {
      "envName": "Production",

      ~~~~~ (Your App Context) ~~~~~

      "repository": "ownername/repositoryname",
      "branch": "main",
      "connectionArn": "arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "prodEnv": {
        "account": "333333333333",
        "region": "ap-northeast-1"
      }
    },
```

### Prod アカウントのセットアップを行う

以下のような形で、Prod アカウントの Profile が設定されているとします。

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

次のとおり手順を実施することで、Tools アカウントから Prod アカウントに対してクロスアカウントなアプリケーションのデプロイを実施することが可能になります。

1. Prod アカウントに SSO でログインする

```sh
aws sso login --profile blea-pipeline-prod-sso
```

2. Prod アカウントのブートストラップを実施する

```sh
npx cdk bootstrap --profile blea-pipeline-dev-exec --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess --trust 222222222222 aws://333333333333/ap-northeast-1 -c environment=prod
```

3. Tools アカウントのブートストラップを実施する

```sh
npx cdk bootstrap -c environment=dev --profile blea-pipeline-tool-exec --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess aws://222222222222/ap-northeast-1
```

4. Tools アカウントに対してパイプラインをデプロイする

```sh
npx cdk deploy -c environment=dev --profile blea-pipeline-tool-exec
```

この Tools アカウントにデプロイされたパイプラインによりアプリケーションがビルド・デプロイされます。

参考情報：https://aws.amazon.com/jp/blogs/news/deploying-a-cdk-application-using-the-cdk-pipelines-modern-api/

## Appendix B - 開発環境へのアプリケーションスタックのデプロイ

実際にシステムを CDK を用いて開発する際には、パイプラインを介さずにスタックをデプロイして検証サイクルを短くすることが必要になることがあります。そのような場合は開発環境用のアカウントに向けて、パイプライン経由ではなく、特定のスタックを直接デプロイすることも可能です。ただし、デプロイ元のコードと実際構成されるシステムの構成を一致させるため、本番環境ではこのような直接的なデプロイは避けるようにしてください。

前提：以下に示されているような形で開発環境用に払い出されたアカウント（以下、Dev アカウント（ID: `xxxxxxxxxxxx`））が、Organization に登録されていて、SSO 経由で Credential を取得することができること

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
      "codestarConnectionArn": "arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
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

### 開発環境に対して Stage を直接デプロイする

例えば、`BLEA-Dev-Stage` 中で定義されている `BLEA-ECSApp` を指定してデプロイしたい場合は以下のコマンドによって Dev アカウントにデプロイすることができます。

```
npx cdk deploy BLEA-Dev-Stage/BLEA-ECSApp -c environment=dev --profile=blea-pipeline-dev-exec
```

なお、以下のようなコマンドによってデプロイできるスタック (上記コマンドにおける`BLEA-Dev-Stage/BLEA-ECSApp`に相当するもの) の一覧を確認することができます

```
npx cdk ls -c environment=dev
```
