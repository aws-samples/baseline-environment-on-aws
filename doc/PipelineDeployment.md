# Deploy CDK Application via CDK Pipelines

[View this page in Japanese (日本語)](PipelineDeployment_ja.md) | [Back to Repository README](../README.md)

As an example of CI/CD with CDK, this document shows how to use sample code to deploy an application using [CDK Pipelines] (https://docs.aws.amazon.com/cdk/v2/guide/cdk_pipeline.html).

CDK Pipelines is a high-level construct library that makes it easy to set up a continuous deployment pipeline for CDK applications with AWS CodePipeline. By quickly building pipelines with CDK pipelines, you can simplify application development and focus on the areas you care about more.

Currently, we are offering the following samples.

- Pipeline for deploying `blea-gov-base-ct` (multi-account baseline)
- Pipeline for deploying `blea-guest-ecs-app-sample` (sample ECS application that accepts CloudFront SSL communication for unique domains)

The deployment of the operating environment itself is done by a pipeline. What you deploy yourself is a pipeline.

If you've already deployed each use case, deploying with CDK Pipelines will deploy the same application under a different stack name. To avoid duplicate billing and deployment failures, we recommend running `npx cdk destroy` to delete stacks that have already been deployed.

## Pipeline Configuration

### Setup (common) - Set up the necessary information for the pipeline

![BLEA-deploy-setup](images/BLEA-DeployECS-01-Setup.png)

Make the necessary settings for CodePipeline to retrieve the source code.

### Configuration pattern A: Deploy pipelines and applications within the same account

![BLEA-deploy-tools](images/BLEA-DeployECS-02-Tool.png)

Deploy both the pipeline and application within the same account. Applications are deployed using pipelines as an opportunity to push against a Git repository. If you perform the required steps shown below, this is the configuration.

### Configuration Pattern B: Deploying an Application from a Pipeline to Another Account

![BLEA-deploy-dev](images/BLEA-DeployECS-03-Dev.png)

Deploy the application to a different account than the account that has the pipeline (Tools account). Of the procedures shown below, when Appendix A is also carried out, this is the configuration.

### Configuration Pattern C: Deploying an Application to Multiple Accounts from a Pipeline

![BLEA-deploy-prod](images/BLEA-DeployECS-04-Prod.png)

As an example of how to deploy an application to multiple accounts, an example of creating a pipeline for each account is shown. This configuration can be verified by performing the tasks required in configuration B for each account.

## 1. Governance-based deployment procedure for configuration pattern A (within the same account)

### Overview of the environment to be built

- Here, we will introduce the procedure for deploying a multi-account governance base (`usecases/blea-gov-base-ct`) through a pipeline
- The pipeline and the governance base deployed from it are created in the same account `Dev` account ID `123456789012`.
- Pipeline parameters are `devPipelineParameter` and governance-based parameters are `devParameter'

### 1-1. Register the BLEA code in the GitHub repository

Please register the BLEA code in the Git repository.
The pipeline monitors Git repositories and kicks the pipeline when the target branch is updated.

### 1-2. Connect to GitHub using AWS CodeStar Connections

The pipeline creates a connection to access the target Git repository.

1. Log into the AWS Management Console for your Tools account
2. Open the CodePipeline service
3. Click Settings=> Connections at the bottom left of the navigation pane, then click Create Connection.

![BLEA-deploy-1-console](images/BLEA-Deploy-1-Console.png)

4. Choose GitHub, specify a Connection name, and then click Connect to GitHub

![blea-deploy-2-chooseGitHub](images/BLEA-Deploy-2-ChooseGitHub.png)

5. Click “Install a new app” to install “AWS Connector for GitHub”

![blea-deploy-3-createConnection](images/BLEA-Deploy-3-CreateConnection.png)

6. On the Install AWS Connector for GitHub screen, select your own repository and click Install. After this, the screen will return to the management console

![blea-deploy-4-installApp](images/BLEA-Deploy-4-InstallApp.png)

7. On the Connect to GitHub page, click Connect

![BLEA-deploy-5-connect](images/BLEA-Deploy-5-Connect.png)

8. Connection's ARN is now displayed on the screen. The format is as follows: Copy this for use after `arn:aws:codestar-connections:ap-northeast-1: xxxxxxxxxxxx: connection/xxxxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx`

![BLEA-deploy-6-finished](images/BLEA-Deploy-6-Finished.png)

### 1-3. Configuring AWS CLI Credentials

Set up an AWS CLI profile for deployment to guest account `Dev`. Here, the guest account ID is `123456789012`

~/.aws/config

```text
# For Guest Account
[profile ct-guest]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 123456789012
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1
```

> **Note** Administrator rights are required when bootstrapping the CDK and when deploying pipelines. From a security standpoint, it is recommended to remove administrator privileges once pipeline deployment is complete (see [CDK Pipelines documentation](https://docs.aws.amazon.com/cdk/api/v1/docs/pipelines-readme.html)).

### 1-4. Set pipeline parameters

Edit the target application's `parameter.ts` file (in this case, `usecases/blea-gov-base-ct/parameters.ts`) and specify the required information. Here, we assume that it will be deployed to the guest account specified with CLI credentials, and env is not explicitly specified.

```typescript
// Parameter for Governance base in Dev account
export const devParameter: AppParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  securitySlackWorkspaceId: 'T8XXXXXXX',
  securitySlackChannelId: 'C00XXXXXXXX',
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};

// Parameter for Pipeline in Dev account
export const devPipelineParameter: PipelineParameter = {
  env: { account: '123456789012', region: 'ap-northeast-1' },
  envName: 'DevPipeline',
  sourceRepository: 'aws-samples/baseline-environment-on-aws',
  sourceBranch: 'main',
  sourceConnectionArn: 'arn:aws:codestar-connections:ap-northeast-1:xxxxxxxxxxxx:connection/example',
};
```

Pipeline-specific parameters are as follows.

- `sourceRepository`: The name of the GitHub repository. If your own repository URL is' https://github.com/ownername/repositoryname.git ', specify `ownername/repositoryname`
- `sourceBranch`: branch name to which the pipeline refers
- `sourceConnectionArn`: GitHub Connection ARN obtained in the previous section

### 1-5. Deploy the pipeline

Deploy the pipeline to the target account by running the following command from your local environment.

```sh
npm ci
cd usecase/blea-gov-base-ct/
npx aws-cdk bootstrap --profile ct-guest  # If you haven't bootstrapped target account
npx aws-cdk deploy --profile ct-guest --app "npx ts-node --prefer-ts-exts bin/blea-gov-base-ct-via-cdk-pipelines.ts"
```

To check the pipeline created, go to the target account's management console and check the CodePipeline screen.

### 1-6. Update the application code, push the changes, and run the deployment

Once the pipeline deployment is complete, change the application (governance-based) code and commit/push. This will run the pipeline and deploy the application (governance-based).

Visit your Tools account to check how your pipeline is running.

> **Note** In CDK Pipelines, by using a function called [SelfMutation](https://aws.amazon.com/jp/blogs/news/deploying-a-cdk-application-using-the-cdk-pipelines-modern-api/), deployment pipelines are also continuously deployed in response to repository updates It's possible. This makes it possible to deploy all stacks defined through the Tools account.

---

## 2. Configuration pattern B cross-account ECS application sample (multi-region) deployment instructions

CDK Pipelines makes it easy to implement pipelines that deploy applications across accounts and regions.
The `usecase/blea-guest-ecs-ecs-app-sample` of this repository is a multi-region configuration where CloudFront is deployed to us-east-1 and application execution environments such as ALB and ECS are deployed in regions specified by users.

Here is the procedure for deploying using the pipeline `bin/blea-guest-ecs-app-sample-via-cdk-pipelines.ts` for cross-account deployment.
Configure the pipeline to the `Pipeline` account `222222222222` and deploy the ECS application sample to the `Dev` account (ID: `111111111111`.

### Prerequisites

- Dev and Pipeline accounts must be registered to the organization and credentials can be obtained using SSO
- The Git repository where the pipeline is deployed is managed as a private repository, and third parties cannot access account information described in `paramter.ts` or pipeline stacks, etc.
- Execution of steps 1-1, 1-2 above has been completed in the Pipeline account

> **Note** In this sample, connection information to the destination account required when the pipeline is deployed must be described in the pipeline parameter file. We recommend that the Git repository that manages this information be a private repository for security reasons. Note that if you fork the aws-samples repository directly, you cannot manage it as a private repository. For example, when developing on GitHub, it is necessary to create a private repository by cloning and pushing this public repository.

### 2-1. Set parameters

Cross-account deployments require you to explicitly specify the target account and region.
Set the commented out account ID of `usecase/blea-guest-ecs-app-sample/parameter.ts` appropriately.

```typescript
// Parameters for Dev Account
export const devParameter: AppParameter = {
  env: {
    account: '111111111111', // Change here
    region: 'ap-northeast-1',
  },
  envName: 'Development',
  monitoringNotifyEmail: 'notify-security@example.com',
  monitoringSlackWorkspaceId: 'TXXXXXXXXXX',
  monitoringSlackChannelId: 'CYYYYYYYYYY',
  vpcCidr: '10.100.0.0/16',
  dashboardName: 'BLEA-ECS-App-Sample',
};

// Parameters for Pipeline Account
export const devPipelineParameter: PipelineParameter = {
  env: {
    account: '222222222222', // Change here
    region: 'ap-northeast-1',
  },
  sourceRepository: 'aws-samples/baseline-environment-on-aws',
  sourceBranch: 'main',
  sourceConnectionArn:
    'arn:aws:codestar-connections:us-west-2:222222222222:connection/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};
```

> **Note** If `crossAccountKeys` is set to `true` in the CodePipeline constructor, the evaluation of account information during testing will be more strict. Specifically, it is necessary to explicitly pass account information (without environment information) in the pipeline stack.

### 2-2. Set up Dev and Pipeline accounts

We will bootstrap so that we can deploy from the Pipeline account to the Dev account us-east-1 and ap-northeast-1.

1. Configuring AWS CLI Credentials
   Set a Profile to ~/.aws/config so you can access your Dev and Pipeline accounts.

```
[profile blea-pipeline-dev]
sso_start_url = https://xxxxxxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 111111111111
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1

[profile blea-pipeline-tools]
sso_start_url = https://xxxxxxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 222222222222
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1
```

> **Note** Administrator rights are required when bootstrapping the CDK and when deploying pipelines. From a security standpoint, it is recommended to remove administrator privileges once pipeline deployment is complete (see [CDK Pipelines documentation](https://docs.aws.amazon.com/cdk/api/v1/docs/pipelines-readme.html)).

2. Log in to your Dev account with SSO and perform bootstrapping

```sh
aws sso login --profile blea-pipeline-dev
npx aws-cdk bootstrap aws://111111111111/ap-northeast-1 aws://111111111111/us-east-1 --trust 222222222222 --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess --profile blea-pipeline-dev
```

3. Log in to your Pipeline account with SSO and perform bootstrapping

```sh
aws sso login --profile blea-pipeline-tools
npx aws-cdk bootstrap aws://222222222222/ap-northeast-1 --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess --profile blea-pipeline-tools
```

### 2-3. Deploy the pipeline

Deploy a pipeline to a Pipeline account

```sh
cd usecase/blea-guest-ecs-app-sample
npx aws-cdk deploy --profile blea-pipeline-tools --app "npx ts-node --prefer-ts-exts bin/blea-guest-ecs-app-sample-via-cdk-pipelines.ts"
```

The pipeline deployed to this Pipeline account will build and deploy the application in the next step.

### 2-4. Update the application code, push the changes, and run the deployment

Once the pipeline deployment is complete, change the application (governance-based) code and commit/push. This will run the pipeline and deploy the application (governance-based).

Visit your Tools account to check how your pipeline is running.

See: https://aws.amazon.com/jp/blogs/news/deploying-a-cdk-application-using-the-cdk-pipelines-modern-api/
