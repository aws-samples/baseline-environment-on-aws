# Baseline Environment on AWS

[![release](https://img.shields.io/github/v/release/aws-samples/baseline-environment-on-aws)](https://github.com/aws-samples/baseline-environment-on-aws/releases)
[![build](https://github.com/aws-samples/baseline-environment-on-aws/workflows/build/badge.svg)](https://github.com/aws-samples/baseline-environment-on-aws/actions?query=workflow%3A"build")

[View this page in Japanese (日本語)](README_ja.md)

Baseline Environment on AWS(BLEA) is a set of reference CDK template to establish secure baseline on standalone-account or ControlTower based multi-account AWS environment. This solution provides basic and extensible guardrail with AWS security services and end-to-end sample CDK code for typical system architecture. This template is also useful to learn more about AWS architecting best practices and how to customize CDK code as we incorporated comments in detail so that users can know why and how to customize.

Jump to | [Changelog](CHANGELOG.md) | [HowTo](doc/HowTo.md) | [Deploy to Multiaccount environment](/doc/DeployToControlTower.md) | [Standalone to ControlTower](doc/Standalone2ControlTower.md) | [Deployment Pipeline](doc/PipelineDeployment.md) |

## Governance Architecture

### Operation patterns

![BLEA-OpsPatterns](doc/images/BLEA-OpsPatterns.png)

### Multi-Account Governance (with ControlTower)

![BLEA-GovOverviewMultiAccount](doc/images/BLEA-GovOverviewMultiAccount.png)

### Standalone Governance (with Individual account)

![BLEA-GovOverviewSingleAccount](doc/images/BLEA-GovOverviewSingleAccount.png)

## Baseline Architecture

### Multi-Account (With ControlTower)

![BLEA-ArchMultiAccount](doc/images/BLEA-ArchMultiAccount.png)

### Standalone (With Individual account)

![BLEA-ArchSingleAccount](doc/images/BLEA-ArchSingleAccount.png)

### Stack Architecture (Standalone)

![BLEA-StackDependency](doc/images/BLEA-StackDependency.png)

## Governance baselines

| use case                                          | folder                              |
| ------------------------------------------------- | ----------------------------------- |
| Standalone governance base                        | `usecases/blea-gov-base-standalone` |
| ControlTower governance base (for guest accounts) | `usecases/blea-gov-base-ct`         |

- The ControlTower governance base sample offers 3 different deployment options

- Direct deployment from the on-hand environment (blea-gov-base-ct.ts) (default)
- Deployment using cdkPipeline (blea-gov-base-ct-via-cdk-pipelines.ts)
- Deployment using ControlTower's Account Factory Customization (blea-giv-base-ct-via-cdk-pipelines.ts)

## Guest System Sample Architectures List

| use case                          | folder                                      |
| --------------------------------- | ------------------------------------------- |
| Web application sample by ECS     | `usecases/blea-guest-ecs-app-sample`        |
| EC2 web application sample        | `usecases/blea-guest-ec2-app-sample`        |
| Serverless API application sample | `usecases/blea-guest-serverless-api-sample` |

- The ECS web application sample offers two different deployment options

- Direct deployment from the on-hand environment (blea-guest-ecs-app-sample.ts) (default)
- Deployment using cdkPipeline (blea-guest-ecs-app-sample-via-cdk-pipelines.ts)

> NOTE: Each use case can be deployed independently

## Deployment flow

The steps to deploy are described. Building an editor environment is not necessarily necessary when only deploying, but it is recommended to prepare a development environment that includes an editor because code changes can be made easier and mistakes can be reduced.

### Prerequisites

#### a. runtime

It uses the following runtimes: Please follow the instructions for each OS to install.

- [Node.js] (https://nodejs.org/) (>= `14.0.0`)
- `npm` (>= `8.1.0`)
- [Git] (https://git-scm.com/)

npm uses workspaces, so 8.1.0 or higher is required. Please install the latest version as follows.

```sh
npm install -g npm
```

#### b. development environment

In order to safely edit CDK code, we recommend setting up a development environment even if you are not doing serious development. Below are instructions for setting up VisualStudioCode.

- [Instructions]: [VisualStudioCode Setup Instructions](doc/HowTo.md#VisualStudioCode-Setup-Instructions)

### Typical Deployment Procedure

The most typical implementation procedure when using BLEA is as follows. Here are the steps to deploy a governance base and guest applications on a single account.

1. Install related libraries and build code

2. Configuring credentials for the AWS CLI

3. Create an account for deployment

4. Deploy a governance base

5. Deploy the guest application sample

> NOTE:
> Here, we will introduce a standalone governance base and a serverless API application sample to a single account.
> For instructions on deploying a multi-account version using ControlTower, see [Deploy to ControlTower environment](doc/DeployToControlTower.md).

## Implementation Procedure

Here, I will explain the simplest implementation of the standalone version to a single account as an example.

### 1. Checkout the repository and initialize the project

#### 1-1. Checkout a repository

```sh
git clone https://github.com/aws-samples/baseline-environment-on-aws.git
cd baseline-environment-on-aws
```

#### 1-2. Initializing a project

Install the required libraries for Node.js.

```sh
# install dependencies
npm ci
```

#### 1-3. Setting up a Git pre-commit hook

Register a hook to perform checks with linter, formatter, and git-secrets when committing to Git. Follow the steps below to set it up. It's not required if you're just deploying, but we recommend setting it up for more secure development.

- [Instructions]: [Git pre-commit hook setup](doc/HowTo.md#Git-pre-commit-hook-setup)

### 2. Set your AWS CLI credentials

AWS credentials (API keys) are required to deploy the CDK. Here's the simplest way to use permanent credentials.

This is a method mainly used for development environments. Here, as an example of an AWS CLI profile, we will consider using two accounts, `prof_dev` and `prof_prod`.

~/.aws/credentials

```text
[prof_dev]
aws_access_key_id = XXXXXXXXXXXXXXX
aws_secret_access_key = YYYYYYYYYYYYYY
region = ap-northeast-1

[prof_prod]
aws_access_key_id = ZZZZZZZZZZZZZZZ
aws_secret_access_key = PPPPPPPPPPPPPPPPPPPP
region = ap-northeast-1
```

### 3. Create an account for deployment

#### 3-1. Create a new account

Use Organizations to create new accounts.
It is possible to use a single account without Organizations, but we recommend using member accounts under Organizations to make it easier to migrate to a multi-account management environment later.

#### 3-2. Set up Slack in preparation for using AWS Chatbot

BLEA uses separate Slack channels for notification of security events and monitoring events. Create 2 channels on Slack and follow the steps below to perform the initial setup of AWS Chatbot.
Once the settings are complete, note down the workspace ID (1) and the notification destination channel ID (2) for later settings.

- [Instructions]: [Set up Slack for AWS ChatBot](doc/HowTo.md#set-up-slack-for-aws-chatbot)

### 4. Deploy a governance base

#### 4-1. Set deployment parameters

You must specify parameters specific to each use case, such as the deployment account and notification email address required during deployment. BLEA manages parameters in a file called `parameter.ts`. The format is TypeScript.

The parameters for the single account baseline are specified here.

```sh
usecases/blea-gov-base-standalone/parameter.ts
```

This example defines a parameter set called `devParameter`. To verify similar settings so that they can be deployed to production accounts, define parameter sets such as `stagingParameter' and `prodParameter', and create stacks for each environment with an App (here `bin/blea-gov-base-standalone.ts`).

usecases/blea-gov-base-standalone/parameter.ts

```typescript
//Example for Development
export const devParameter: appParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  securitySlackWorkspaceID: 'T8XXXXXXX',
  securitySlackChannelID: 'C00XXXXXXXX',
  //env: {account: '123456789012', region: 'ap-northeast-1'},
};
```

The details of this setting are as follows.

| key                      | value                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| envName                  | Environment name. This will be set to each resource tag                                                     |
| securityNotifyEmail      | The email address to which security notifications will be sent. The content is similar to Slack             |
| securitySlackWorkspaceID | Slack Workspace ID set to AWS Chatbot                                                                       |
| securitySlackChannelID   | The ID of the Slack channel set to AWS Chatbot. Security notifications are made through the governance base |
| env                      | The account and region to be deployed (if not specified, it will follow CLI credentials)                    |

> NOTE: BLEA used Context (cdk.json) to set parameters until v2.x, but after v3.0, parameter.ts is used.

#### 4-2. Deploy a governance base

If you're running the CDK for the first time, go to the target use case directory and bootstrap the CDK. This is required the first time you run the CDK with the target account and region combination.

```sh
cd usecases/blea-gov-base-standalone
npx aws-cdk bootstrap --profile prof_dev
```

> NOTE:
>
> > - Here, `npx aws-cdk` is used to use the local cdk installed in the BLEA environment. If you start a command directly from `cdk` without using `npx`, the globally installed cdk will be used.
>
> - There are options that are useful when using the cdk command. See [Skip Deployment Approvals and Don't Roll Back](doc/HowTo.md#skip-deployment-approvals-and-dont-roll-back).

Deploy a governance base.

```sh
npx aws-cdk deploy --all --profile prof_dev
```

This sets up the following features

- API logging with CloudTrail
- Record configuration changes with AWS Config
- Detecting unusual behavior with GuardDuty
- Deviation detection from best practices by SecurityHub (AWS Foundational Security Best Practice, CIS Benchmark)
- Default security group blocked (automatically repaired if deviated)
- AWS Health event notifications
- Notification of change actions that affect security (partial)
- Create an SNS topic (SecurityAlarmTopic) to notify security events
- Send emails and send notifications to Slack's secure channels via the above SNS topics

#### 4-3. (Optional) Set up other baseline setups manually

In addition to setting up on a governance basis, AWS provides several operational baseline services. Please set up these services as needed.

##### a. Activate Amazon Inspector

Amazon Inspector scans workloads and manages vulnerabilities. We continuously scan EC2 and ECR to detect software vulnerabilities and unintended network exposure. Detected vulnerabilities are prioritized and displayed based on calculated risk scores, so results can be obtained with high visibility. Additionally, it is automatically integrated with Security Hub, and detection results can be checked centrally.

Setup instructions: [https://docs.aws.amazon.com/inspector/latest/user/getting_started_tutorial.html]

##### b. Perform AWS Systems Manager Quick Setup for EC2 management

If you use EC2, we recommend managing it using SystemsManager. By using the AWS Systems Manager Quick Setup, you can automate the basic setup required to manage EC2.
See: [https://docs.aws.amazon.com/systems-manager/latest/userguide/quick-setup-host-management.html]

Quick Setup provides the following features:

- Configure the AWS Identity and Access Management (IAM) instance profile roles required by Systems Manager
- SSM Agent automatic updates every other week
- Inventory metadata collection every 30 minutes
- Daily scans to detect instances running out of patches
- First-time Amazon CloudWatch agent installation and configuration
- Automatic monthly CloudWatch agent updates

##### c. Trusted Advisor Detection Results Report

TrustedAdvisor provides advice for following AWS best practices. Report details can be received by email on a regular basis. See the documentation below for more details.

- See: [https://docs.aws.amazon.com/awssupport/latest/user/get-started-with-aws-trusted-advisor.html#preferences-trusted-advisor-console]

### 5. Deploy the guest application sample

Once the governance-based configuration is complete, guest applications are deployed on top of it.
Here are the steps to deploy the serverless API application sample as an example of a guest application.

#### 5-1. Set guest application parameters

Configure the guest application prior to deployment.
Go to `usecases/blea-guest-serverless-api-sample` where the serverless API application sample is located and edit the parameter.ts.

usecases/blea-guest-serverless-api-sample/parameter.ts

```typescript
//example
export const devParameter: appParameter = {
 envName: 'Development',
 monitoringNotifyEmail: 'notify-security@example.com',
 monitoringSlack WorkspaceID: 'TXXXXXXXXXX',
 monitoringSlackChannelID: 'CYYYYYYYYY',
 //env: {account: '123456789012', region: 'ap-northeast-1'},
};
```

The settings are as follows:

| key                        |                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| envName                    | Environment name. This is set to each resource tag.                                                                                                                |
| MonitoringNotifyEmail      | An email address to which notifications about system monitoring will be sent.                                                                                      |
| SlackNotifier.workspaceID  | Slack workspace ID set to AWS Chatbot                                                                                                                              |
| SlackNotifier.channelIdmon | The ID of the Slack channel set to AWS Chatbot. A notification about system monitoring will be sent. Please specify a different channel than the security channel. |
| env                        | The account and region to be deployed (if not specified, it will follow CLI credentials)                                                                           |

#### 5-2. Deploy a guest application

```sh
cd usecases/blea-guest-serverless-api-sample
npx aws-cdk deploy --all --profile prof_dev
```

This completes the deployment of the baseline and sample application to a single account.

#### 5-3. Develop your own applications

After that, I will start with this sample code and develop applications tailored to my use case. It shows the information required for general development.

- [Development process](doc/HowTo.md#development-process)
- [Update package dependencies](doc/HowTo.md#update-package-dependencies)

#### 5-4. Remediation of security issues

Even after deploying the governance base, there are detections whose importance is reported at the CRITICAL or HIGH level in the Security Hub benchmark report. Manual action is required for these. If necessary, perform remediation (Remediation).

- [Remediate Security Issues](doc/HowTo.md#remediate-security-issues)

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 license. See the LICENSE file.
