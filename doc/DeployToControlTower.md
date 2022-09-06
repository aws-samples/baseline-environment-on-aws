# Deploy to ControlTower environment

[View this page in Japanese (日本語)](DeployToControlTower_ja.md) | [Back to Repository README](../README.md)

This section describes the procedure for deploying BLEA to ControlTower-managed accounts.

## Deployment procedure

The steps to deploy are as follows: If you're just deploying, you don't need to build a build environment, but it's a good idea to have a development environment that includes an editor to make code changes easier.

### Prerequisites

#### a. runtime

- Runtime and other prerequisites are the same as in the Standalone version. [README](../README.md)
- Prerequisites for using AWS SSO
  - Requires [Python3](https://www.python.org/) (>= `3.8`) to use `aws2-wrap`.
  - For integration with AWS SSO, you need [AWS CLI version2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html).

#### b. Development environment

We recommend that you set up a development environment, even if you are not doing serious development, to ensure safe editing of CDK code. The following are the steps to set up VisualStudioCode.

- [Instructions]: [VisualStudioCode Setup Instructions](HowTo.md#VisualStudioCode-Setup-Instructions)

### Implementation procedure under ControlTower

This example explains how to deploy a sample application as a guest system with a multi-account governance base under ControlTower. Where `MC` indicates working in the management console and `Local` is working on your laptop.

1. Set up ControlTower and Security Services (MC)

2. Create a guest account for deployment in ControlTower (MC)

3. Install Dependencies and Build Code (Local)

4. Configure AWS CLI credentials for AWS SSO (Local)

5. Set a baseline for notifications in the Audit account (Local)

6. Deploy a governance base for guest accounts (Local)

7. Deploy Guest Application Samples (Local)

## Implementation steps

### 1. Set up ControlTower and Security Services (MC)

By using ControlTower, some governance-based features are automatically configured. Security services that are not supported by ControlTower can be bulk-enabled for Organizations so that they are automatically configured when new accounts are created It will be.

Here we set up ControlTower, SecurityHub, GuardDuty, Inspector and IAM Access for the entire Organizations Provides step-by-step instructions on how to enable Analyzer. Specify the Audit account as these delegate accounts.

#### 1-1. ControlTower setup

Set up ControlTower.
See: [https://docs.aws.amazon.com/controltower/latest/userguide/setting-up.html]

> NOTE:
>
> From AWS Control Tower landing zone ver.3.0, when the CloudTrail configuration is enabled, the CloudTrail logs are aggregated into AWS CloudWatch Logs for your ManagementAccount.

> Ref：https://docs.aws.amazon.com/controltower/latest/userguide/2022-all.html#version-3.0
>
> As a result, there is no CloudWatch Logs LogGroup that previously existed on the guest account to which CloudTrail logs were output. So, this prevents CloudTrail log monitoring, which was provided by the guest account's governance base.
>
> By default, BLEA assumes an LZ3.0 or later environment with the following prerequisites:
> If you want to deploy a governance base outside of the prerequisite environments, please refer to [6-2. (Optional) Modify the code to match Control Tower landing zone settings](#6-2-governance-based-deployment-to-guest-accounts)
>
> Prerequisites：
>
> - Start using Control Tower from landing zone ver.3.0, and being enable CloudTrail.

#### 1-2. Set up SecurityHub

- [https://docs.aws.amazon.com/securityhub/latest/userguide/designate-orgs-admin-account.html]
- [https://docs.aws.amazon.com/securityhub/latest/userguide/accounts-orgs-auto-enable.html]

#### 1-3. Set up GuardDuty

- [https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_organizations.html]

#### 1-4. Set up Amazon Inspector

Designating a delegated administrator

- [https://docs.aws.amazon.com/inspector/latest/user/designating-admin.html]

Enabling for member accounts

- [https://docs.aws.amazon.com/inspector/latest/user/adding-member-accounts.html]

#### 1-5. Setting Up the IAM Access Analyzer

- [https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-settings.html#access-analyzer-delegated-administrator]

#### 1-6. Set up Trusted Advisor

- [https://docs.aws.amazon.com/awssupport/latest/user/organizational-view.html]

### 2. Create a guest account for deployment in ControlTower (MC)

#### 2-1. Create a guest account

Create a new account (guest account) using ControlTower.

> See: [https://docs.aws.amazon.com/controltower/latest/userguide/account-factory.html#quick-account-provisioning]

#### 2-2. Set up Slack workspaces in advance for AWS Chatbot

Configure Slack integration settings for security and monitoring event notifications for guest accounts. Create a channel in Slack for security notifications, and a channel for system monitoring notifications, and follow these steps to configure Chatbot. When you are done, make a note of the ID of the workspace (1) and the ID of the channel you want to notify (2) for later settings.

- [Instructions]: [Set up Slack for AWS ChatBot](HowTo.md#set-up-slack-for-aws-chatbot)

### 3. Install Dependencies and Build Code (Local)

#### 3-1. Retrieving repositories

```sh
git clone https://github.com/aws-samples/baseline-environment-on-aws.git
cd baseline-environment-on-aws
```

#### 3-2. Installing Dependent NPM Packages

```sh
# install dependencies
npm ci
```

#### 3-3. Setting Up Git-Secrets

Registers a hook to perform checks by Linter, Formatter, and Git-Secrets when committing to Git. Follow the steps below to set it up. It is not required if you are just deploying, but we recommend a setup for more secure development.

- [Instructions]: [Git pre-commit hook setup](HowTo.md#Git-pre-commit-hook-setup)

### 4. Configure AWS CLI credentials for AWS SSO (Local)

Permanent credentials are also available, but AWS SSO is recommended for ControlTower environments. AWS SSO allows you to log in to the Management Console and run the AWS CLI with SSO authentication.

> NOTE:
>
> Starting with CDK v2.18.0, you can use AWS SSO profiles to deploy the CDK directly, eliminating the need to use wrapping in the authentication process within the profile.

#### 4-1. Check the version of the AWS CLI

AWS CLI - To use the AWS SSO integration, you must use AWS CLIv2.

- See: [https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html]

Check the CLI version as follows:

```sh
aws --version
```

Verify that the output is version 2 or higher

```sh
aws-cli/2.3.0 Python/3.8.8 Darwin/20.6.0 exe/x86_64 prompt/off
```

#### 4-2. Configure an AWS CLI Profile for Audit Account Deployment

Next, configure a CLI profile for deploying to the Audit account in Control Tower. Here, the ID of the Audit account is `2222222222`.

~/.aws/config

```text
# for Audit Account
[profile ct-audit]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 222222222222
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1
```

> NOTE:
>
> According to the ControlTower specification, in order to modify the resouces created by ControlTower in the Audit account, you must first use the `AWSAdministratorAccess` role of the management account You must log in and switch to the `AWSControlTowerExecution` role in the Audit account to perform the action.
> BLEA doen't modify resources created by ControlTower, so we use AWSAdministratorAccess role in the Audit account directly.

#### 4-3. Configure an AWS CLI Profile for Guest Account Deployment

Configure an AWS CLI profile for deploying to the guest account. Here, the ID of the guest account is `123456789012`.

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

#### 4-4. CLI login using AWS SSO

Log in to AWS SSO with the following command: Here is an example of logging in with `ct-guest`profile.

```sh
aws sso login --profile ct-guest
```

This command launches a browser and displays the AWS SSO login screen. If you have entered the guest account administrator username (email address) and password correctly, the screen will return to the terminal, where you can use the AWS CLI to work with the guest account.

### 5. Set a baseline for notifications in the Audit account (Local)

The Audit account has an SNS Topic created by ControlTower that sends all AWS Config change notifications. Set a baseline to notify Slack of this content.
Only setting up AWS Chatbot is done in the management console, and any further work is done locally.

> NOTE:
>
> You don't need to set this baseline if you don't need AWS Config notifications. It does not affect the behavior of other accounts.

> NOTE:
>
> You are not notified of the vulnerabilities detected by Amazon Inspector with Slack. You can check it on Security Hub Console.

#### 5-1. Slack setup for AWS Chatbot

Log in to your Audit account in the management console and set up Slack Workspace on AWS Chatbot. We will only create one for the aggregation. Please refer to the steps below

- [Instructions]: [Set up Slack for AWS ChatBot](HowTo.md#set-up-slack-for-aws-chatbot)

#### 5-2. Set deployment information (Context)

Specify the parameters in the CDK Context (cdk.json) of the use case for the Audit account in ControlTower. The configuration file is here. By default, a context named dev-audit is set.

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
        "account": "222222222222",
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

The contents of this setting are as follows.

| key                        | value                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| description                | Comment on settings                                                                                                                 |
| envName                    | Environment name. This will be set for each resource tag                                                                            |
| env.account                | The account ID to deploy to. Must match the account specified in CLI profile                                                        |
| env.region                 | Region to deploy to. Must match the region specified in CLI profile                                                                 |
| SlackNotifier.WorkspaceID  | ID of Slack workspace set on AWS Chatbot                                                                                            |
| SlackNotifier.channelIDAGG | The ID of the Slack channel you set for AWS Chatbot. You will be notified of all AWS Config changes for accounts under ControlTower |

> NOTE: See the following explanation for how to use Context
>
> - [Manage personal environment by cdk.context.json](HowTo.md#Manage-personal-environment-by-cdkcontextjson)
>
> - [Accessing context in application](HowTo.md#accessing-context-in-application)

#### 5-3. Deploy a baseline for the Audit account

Log in to your management account using AWS SSO with the following command:

```sh
aws sso login --profile ct-audit
```

Bootstrap a bucket for CDK to the Audit account (first time only)

```sh
cd usecases/base-ct-audit
npx cdk bootstrap -c environment=dev-audit --profile ct-audit
```

Deploy a governance base to the Audit account

```sh
cd usecases/base-ct-audit
npx cdk deploy --all -c environment=dev-audit --profile ct-audit
```

You should now be notified of all AWS Config change events for accounts managed by this ControlTower.

> NOTE:
>
> - Here we are using `npx` to use a local cdk installed in the BLEA environment. If you start the command directly from `cdk`, the globally installed cdk will be used.
>
> - There are options that are useful when using the cdk command. See [Skip Deployment Approvals and Don't Roll Back](HowTo.md#skip-deployment-approvals-and-dont-roll-back).

### 6. Deploy a governance base for guest accounts (Local)

#### 6-1. Set deployment information (Context)

You must specify parameters in the CDK Context (cdk.json) for deployment. Here is the configuration file for the guest account governance base for ControlTower.

```sh
usecases/base-ct-guest/cdk.json
```

This example shows an example of defining Contexts called `dev` and `staging`. To verify the same configuration and deploy it to a production account, prepare a Context such as `staging` or `prod`.

> NOTE:
>
> If you want to explicitly specify the account to be deployed, specify `env`. This makes it impossible to deploy if the account-region specified in the CLI Profile does not match the one specified in `env`. You can ensure that you manage the parameters you set for your account and prevent them from deploying to the wrong account. It is recommended to also specify `env` as much as possible.

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
        "account": "123456789012",
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

The contents of this setting are as follows.

| key                        | value                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| description                | Comment on settings                                                                                 |
| env.account                | The account ID to deploy to. Must match the account specified in CLI profile                        |
| env.region                 | Region to deploy to. Must match the region specified in CLI profile                                 |
| envName                    | Environment name. This will be set for each resource tag                                            |
| securityNotifyEmail        | The email address to which security notifications will be sent. The content is similar to Slack     |
| SlackNotifier.WorkspaceID  | ID of Slack workspace set on AWS Chatbot                                                            |
| SlackNotifier.channelIDSec | The ID of the Slack channel that you configured on AWS Chatbot. You will be notified about security |

#### 6-2. (Optional) Modify the code to match Control Tower landing zone settings

Skip this section if the environment matches [prerequisites in 1-1. ControlTower setup](#1-1-ControlTower-setup).

First, use the following flow chart to check the appropriate way for your environment.
Abbreviations in the figure are as follows:

- CT: Control Tower
- LZ: Landing Zone
- CTrail: CloudTrail

```mermaid
flowchart TD
A[START] --> B{Whether CT LZ <br />is using or not?}
B -->|Using| C{Will CT LZ <br/>be updated to v3.0?}
C -->|YES, will update to v3.0| D{Turn on <br />the configuration <br />of CTrail in LZ}
C -->|NO, continue to use current ver.| F
D -->|YES, turn on CloudTrail| F[a: Use existing resource <br />on the guest account]
D -->|NO, turn off the CloudTrail| G[b: Create a new resource <br />on the guest account]
B -->|Not using| G
```

Also, just in case, before modifying the source code,
please check if there is a log group named `aws-controltower/CloudTrailLogs` in the guest account's CloudWatch Logs.

##### a. Use existing resource on the guest account

This is the case where exisitng of a log group named `aws-controltower/CloudTrailLogs` in the guest account's CloudWatch Logs.

Please delete the following code defined in BLEA and insert the code to use the existing resource.

**_ The code to delete _**

Please delete the following two places.

```
import { BLEATrailStack } from '../lib/blea-trail-stack';
```

```
const trail = new BLEATrailStack(app, `${pjPrefix}-Trail`, { env: getProcEnv() });
const logGroupName = trail.cloudTrailLogGroup.logGroupName;
```

**_ The code to insert _**

Please add settings to use an existing LogGroup.

```
const logGroupName = 'aws-controltower/CloudTrailLogs';
```

##### b. Create a new resource on the guest account

Similar to the prerequisite environment, this environment requires the addition of a LogGroup.
Please deploy without modifying the source code.

#### 6-3. Governance-based deployment to guest accounts

Log in to your guest account using AWS SSO.

```sh
aws sso login --profile ct-guest
```

Bootstrap a bucket for CDK (first time only).

```sh
cd usecases/base-ct-guest
npx cdk bootstrap -c environment=dev --profile ct-guest
```

> NOTE:
>
> - Here we are using `npx` to use a local cdk installed in the BLEA environment. If you start the command directly from `cdk`, the globally installed cdk will be used.
>
> - There are options that are useful when using the cdk command. See [Skip Deployment Approvals and Don't Roll Back](HowTo.md#skip-deployment-approvals-and-dont-roll-back).

Deploy a governance base for guest accounts.

```sh
cd usecases/base-ct-guest
npx cdk deploy --all -c environment=dev --profile ct-guest
```

This will set up the following features

- Default security group blockage (auto repair in case of deviation)
- Notifications for AWS Health events
- Some notifications of security-impacting change actions
- Slack notifies you of security events

The following settings that were set up in the Standalone version are configured by ControlTower and Security Services Organizations support.

- API logging with CloudTrail
- Recording configuration changes with AWS Config
- Detecting vulnerability with Inspector
- Detect abnormal behavior with GuardDuty
- Detecting Deviations from Best Practices with SecurityHub (AWS Foundational Security Best Practice, CIS benchmark)

#### 6-4. (Optional) Set up other baseline setups manually

Besides setting up on a governance basis
AWS provides several operational baseline services. Set up these services as needed.

##### a. Enabling Amazon Inspector and Detecting Vaulnerability

Amazon Inspector checks workload vulnerabilities. It detects software vulnerabilities and unintended network exposure with continuous scanning EC2 and ECR. Detected vulnerabilities are prioritized and displayed based on a calculated risk score, giving you high visibility into the results. It could be automatically integrated with Security Hub and viewed the results centrally.

Setup steps: [https://docs.aws.amazon.com/inspector/latest/user/getting_started_tutorial.html]

##### b. Perform AWS Systems Manager Quick Setup for EC2 Management

If you use EC2, we recommend that you use SystemsManager to manage it. You can use AWS Systems Manager Quick Setup to automate the basic setup required to manage EC2.
Setup steps: [https://docs.aws.amazon.com/systems-manager/latest/userguide/quick-setup-host-management.html]

Quick Setup provides the following features:

- Configure AWS Identity and Access Management (IAM) Instance Profile Roles Required by Systems Manager
- Auto-update of SSM Agent every other week
- Collect inventory metadata every 30 minutes
- Daily scans to detect instances that are out of patch
- Installing and configuring Amazon CloudWatch Agent for the first time only
- Monthly automatic updates of the CloudWatch agent

##### c. Trusted Advisor Detection Results Report

TrustedAdvisor provides advice for following AWS best practices. It is possible to receive the contents of the report regularly by e-mail. Please refer to the following document for details.

- See: [https://docs.aws.amazon.com/awssupport/latest/user/get-started-with-aws-trusted-advisor.html#preferences-trusted-advisor-console]

### 7. Deploy Guest Application Samples (Local)

Once the governance base is set, you can deploy the same guest application sample for both Standalone and ControlTower using the same steps.

Here are the deployment steps from SSO authenticating to the guest account.

#### 7-1. Set the Context for the guest application

Configure the Context using the same steps as in the Standalone version.

#### 7-2. Deploy a guest application

(If you are not logged in) Log in to your guest account using AWS SSO.

```sh
aws sso login --profile ct-guest
```

Deploy a guest application.

```sh
cd usecases/guest-webapp-sample
npx cdk deploy --all -c environment=dev --profile ct-guest
```

This completes the baseline and sample application deployment for a single account.

> NOTE:
>
> It takes about 30 minutes to complete the deployment of all resources, including Aurora. If you want to deploy only some resources, specify the target stack name explicitly. The stack name is expressed in the application code (here bin/blea-guest-ecsapp-sample.ts) as `${pjPrefix}-ecsApp` .
>
> ```sh
> cd usecases/guest-webapp-sample
> npx cdk deploy "BLEA-ECSApp" --app "npx ts-node --prefer-ts-exts bin/blea-guest-asgapp-sample.ts" -c environment=dev --profile prof_dev
> ```
>
> NOTE:
> guest-webapp-sample provides several variations under the bin directory. By default, the application specified in `app` in cdk.json (blea-guest-ecsapp-sample.ts) is deployed. If you want to deploy another application, you can do so by explicitly specifying `---app` in the cdk argument as follows: All contexts in cdk.json work with the same content within the same use case.
>
> ```sh
> cd usecases/guest-webapp-sample
> npx cdk deploy --all --app "npx ts-node --prefer-ts-exts bin/blea-guest-asgapp-sample.ts" -c environment=dev --profile prof_dev
> ```

#### 7-3. Develop your own applications

From now on, you will use this sample code as a starting point to develop applications tailored to your use case. Indicates information necessary for general development.

- [Development process](HowTo.md#development-process)
- [Update package dependencies](HowTo.md#update-package-dependencies)

#### 7-4. Remediation of security issues

Even after deploying a governance base, there are detections that are reported at a critical or high severity level in Security Hub benchmark reports . You will need to take action on these manually. If necessary, perform remediation.

- [Remediate Security Issues](HowTo.md#remediate-security-issues)
