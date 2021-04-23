# Baseline Environment on AWS

Baseline Environment on AWS is a set of reference CDK template to establish secure baseline on standalone-account or ControlTower based multi-account AWS environment. This solution provides basic and extensible guardrail with AWS security services and end-to-end sample CDK code for typical system architecture. This template is also useful to learn more about AWS architecting best practices and how to customize CDK code as we incorporated comments in detail so that users can know why and how to customize.

# Governance Architecture

## Operation patterns

![BLEA-OpsPatterns](/doc/images/BLEA-OpsPatterns.png)

## Multi-Account Governance (With ControlTower)

![BLEA-GovOverviewMultiAccount](/doc/images/BLEA-GovOverviewMultiAccount.png)

## Standalone Governance (With Individual account)

![BLEA-GovOverviewSingleAccount](/doc/images/BLEA-GovOverviewSingleAccount.png)

# Baseline Architecture

## Multi-Account (With ControlTower)

![BLEA-ArchMultiAccount](/doc/images/BLEA-ArchMultiAccount.png)

## Standalone (With Individual account)

![BLEA-ArchSingleAccount](/doc/images/BLEA-ArchSingleAccount.png)

## Stack Architecture (Standalone)

![BLEA-StackDependency](/doc/images/BLEA-StackDependency.png)

# Sample Architectures on Guest Account

## ECS

![BLEA-GuestSampleECS](/doc/images/BLEA-GuestSampleECS.png)

## AutoSacling

![BLEA-GuestSampleASG](/doc/images/BLEA-GuestSampleASG.png)

## EC2

![BLEA-GuestSampleEC2](/doc/images/BLEA-GuestSampleEC2.png)

# Deployment

> Information: \
> This deployment process uses AWS credential (e.g. API secret key) on your local PC/Mac. If you want to use CloudShell, please see `Appendix A` that on a bottom of this document.

# 1. Setup CDK prerequisities and build

See: https://docs.aws.amazon.com/ja_jp/cdk/latest/guide/getting_started.html

- TypeScript 2.7 or later

```
npm -g install typescript
```

- CDK 1.97.0 or later

```
npm install -g aws-cdk
```

- Build

```
cd path-to-source
npm ci
npm run build
```

## (OPTIONAL) Use latest CDK modules

After install CDK, Use below commands instead of "npm ci".

- Install ncu

```
npm install -g npm-check-updates
```

- Update modules

```
cd path-to-source
rm -rf package-lock.json node_modules/
ncu -u
npm install
```

- Build

```
npm run build
```

# 3. Setup AWS CLI/CDK Configurations

## Optioin1. Setup AWS Credentials (Permanent Credentials)

For development purpose, you can use permanent credentials for IAM User created on each account. Here is an example for using `prof_dev` and `prof_prod` account.

```
$ vi ~/.aws/credentials

[prof_dev]
aws_access_key_id = XXXXXXXXXXXXXXX
aws_secret_access_key = YYYYYYYYYYYYYYY
rgion = ap-northeast-1

[prof_prod]
aws_access_key_id = ZZZZZZZZZZZZZZZZ
aws_secret_access_key = PPPPPPPPPPPPPPPP
region = ap-northeast-1
```

## Option2. Setup AWS Credentials (with AWS SSO)

We recommend to use AWS SSO to login AWS Management Console and AWS CLI - AWS SSO Integration.

> Notes: For AWS CLI-AWS SSO Integration, you need to use AWS CLIv2
> See: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html

To use AWS CLI - AWS SSO Integration from AWS CDK, you need to install opensource tool aws2-wrap (https://github.com/linaro-its/aws2-wrap) on your build environment.

```
$ pip3 install aws2-wrap
```

Configure AWS CLI profile for deploying to Audit Account. This example assume Management Account ID as `1111111111111`, Audit Account ID as `222222222222`.

~/.aws/config

```
# for Management Account
[profile ct-master-sso]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start#/
sso_region = ap-northeast-1
sso_account_id = 1111111111111
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1

# for AWSControlTowerExecution Role on Audit Account
[profile ct-audit-exec-role]
role_arn = arn:aws:iam::222222222222:role/AWSControlTowerExecution
source_profile = ct-master-sso
region = ap-northeast-1

# for CDK access to ct-audit-exec-role
[profile ct-audit-exec]
credential_process = aws2-wrap --process --profile ct-audit-exec-role
region = ap-northeast-1
```

Configure AWS CLI profile for deploying to Guest Account.

~/.aws/config

```
# for Guest Account
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

Now, you can login with AWS SSO like this.

```
$ aws sso login ct-guest-sso
```

This command display AWS SSO login window on your browser. Enter username and password, then you will go back to terminal and can access with AWS CLI with profile `ct-guest-sso`. On AWS CDK, you need to use profile `ct-guest`.

# 4. Define parameters in CDK Context

You need to define deployment parameters on CDK Context. Context values are defined in cdk.json file or cdk.context.json file (or -c option).

- See: https://docs.aws.amazon.com/ja_jp/cdk/latest/guide/context.html
- See: https://docs.aws.amazon.com/ja_jp/cdk/latest/guide/get_context_var.html

## 1. Sample cdk.json and cdk.context.json:

These files define `dev`, `prod`, `ctaudit`, `my` context. cdk.json is managed by git. cdk.context.json doesn't managed by git so you can use it just for your local environmen only.

cdk.json

```
{
  "app": "npx ts-node bin/blea-base-sa.ts",
  "context": {
    "dev": {
      "description": "Environment variables for blea-guest-*-samples.ts",
      "envName": "Development",
      "vpcCidr": "10.100.0.0/16",
      "securityNotifyEmail": "notify-security@example.com",
      "monitoringNotifyEmail": "notify-monitoring@example.com",
      "dbUser": "dbadmin",
      "slackNotifier": {
        "workspaceId": "T8XXXXXXX",
        "channelIdSec": "C01XXXXXXXX",
        "channelIdMon": "C01YYYYYYYY"
      }
    },
    "prod": {
      "description": "Environment variables for blea-guest-*-samples.ts",
      "envName": "Production",
      "vpcCidr": "10.110.0.0/16",
      "securityNotifyEmail": "notify-security@example.com",
      "monitoringNotifyEmail": "notify-monitoring@example.com",
      "dbUser": "dbadmin",
      "slackNotifier": {
        "workspaceId": "T8XXXXXXX",
        "channelIdSec": "C01XXXXXXXX",
        "channelIdMon": "C01YYYYYYYY"
      }
    },
    "ctaudit": {
      "description": "Environment variables for blea-base-ct-audit.ts",
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

You can create cdk.context.json to define your developing environment parameters. It may be generated automatically. This file is ignored by git.

cdk.context.json

```
{
  "@aws-cdk/core:enableStackNameDuplicates": "true",
  "aws-cdk:enableDiffNoFail": "true",
  "@aws-cdk/core:stackRelativeExports": "true",
  "my": {
    "description": "Personal Environment variables for blea-guest-*-samples.ts",
    "envName": "Personal",
    "vpcCidr": "10.100.0.0/16",
    "securityNotifyEmail": "xxx@example.com",
    "monitoringNotifyEmail": "zzz@example.com",
    "dbUser": "personaluser",
    "slackNotifier": {
      "workspaceId": "T8XXXXXXXXX",
      "channelIdSec": "C01YYYYYYYY",
      "channelIdMon": "C02YYYYYYYY"
    }
  },
  "myaudit": {
    "description": "Personal Environment variables for blea-base-ct-audit.ts",
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
```

> Tips: This is example of how CDK code use this context optioin.
>
> ```
> const envKey = app.node.tryGetContext('environment');
> const valArray = app.node.tryGetContext(envKey);
> const environment_name = valArray['envName'];
> ```

> Tips: How to Deploy stack with context parameters. (This command deploys `bin/blea-base-sa.ts`. It defined on cdk.json `app`)
> Use `--profile xxxxx` to specify AWS profile. Use `-c envrionment=xxxx` to specify parameters you defined in cdk.json.
>
> ```
> $ cdk deploy "*" --profile prof_dev  -c environment=dev
> $ cdk deploy "*" --profile prof_prod -c environment=prod
> ```

> Tips: If you don't want to block deploy process with approval, add an option `--require-approval never` (but be careful!). \
>  When you configure cdk.json like this, you don't need to specify `--require-approval never` on every deploy command.
>
> > ```
> > "requireApproval": "never",
> > ```

# 6. Baseline and Sample templates

We provide several guardrail templates and sample application templates. They are placed in `bin/` directory.

## Base for ControlTower

- blea-base-ct-audit.ts

  - Governance Base for ControlTower Audit Account.

- blea-base-ct-guest.ts
  - Guest Base(for eatch guest account). Setup log bucket, IAM User, Monitoring Chatbot for the account you specified.

## Base for Santdalone

- blea-base-sa.ts
  - Setup Governance Base for Standalone environment.

## Guest System samples

- blea-guest-ecsapp-sample.ts
  - Sample app with ECS/Fargate+AuroraPostgreSQL
- blea-guest-asgapp-sample.ts
  - Sample app with EC2 Autoscaling Group+AuroraPostgreSQL
- blea-guest-ec2app-sample.ts
  - Sample app with EC2+AuroraPostgreSQL

# 7. Deploying on Single Account Environment

(If you want to deploy to ControlTower environment, go to step 8)

## 1. Create new account

Create new account using Organizations. (Or you can use just standalone account without Organizations).

## 2. Setup Slack for AWS Chatbot

See: `Appendix B`

## 3. Deploy Governance Base for Standalone and Sample Apps

If this is a first time to use CDK on the account and region, you need to bootstrap CDK.

```
$ cdk bootstrap --app "npx ts-node bin/blea-base-sa.ts"             -c environment=dev --profile prof_dev
```

Deploy baseline and guest app.

```
$ cdk deploy "*" --app "npx ts-node bin/blea-base-sa.ts"             -c environment=dev --profile prof_dev
$ cdk deploy "*" --app "npx ts-node bin/blea-guest-ecsapp-sample.ts" -c environment=dev --profile prof_dev

```

Now you finished to deploy AWS Baseline template on single account environment.

# 8. Deploying on Multi-Account Environment

## 1. Setup ControlTower

Setup ControlTower.
See: https://docs.aws.amazon.com/controltower/latest/userguide/setting-up.html

## 2. Setup Security services

Setup SecurityHub, GuardDuty and IAM Access Analyzer for Organizations. You should specify deligate account to Audit account.

SecurityHub

- https://docs.aws.amazon.com/securityhub/latest/userguide/designate-orgs-admin-account.html
- https://docs.aws.amazon.com/securityhub/latest/userguide/accounts-orgs-auto-enable.html

GuardDuty

- https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_organizations.html

IAM Access Analyzer

- https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-settings.html#access-analyzer-delegated-administrator

## 3. Deploy Governance Base for CT (to audit account)

### Setup Slack for AWS Chatbot

Setup Slack Workspace on Audit account. \
See `Appendix B`

### Deploy

```
$ aws sso login ct-master-sso
$ cdk bootstrap  --app "npx ts-node bin/blea-base-ct-audit.ts" -c environment=ctaudit --profile ct-audit-exec  # First time only
$ cdk deploy "*" --app "npx ts-node bin/blea-base-ct-audit.ts" -c environment=ctaudit --profile ct-audit-exec
```

## 4. Create new account

Create new account with Account Vending Machine provided by ControlTower.

## 5. Deploy Guest Base and Sample Applications for CT (to guest account)

```
$ aws sso login ct-guest-sso
$ cdk deploy "*" --app "npx ts-node bin/blea-base-ct-guest.ts" -c environment=dev --profile ct-guest # First time only
$ cdk deploy "*" --app "npx ts-node bin/blea-guest-ecsapp-sample.ts" -c environment=dev --profile ct-guest
```

Now you finished to deploy AWS Baseline template on multi account environment.

# 9. Remediation

Some SecurityHub benchmark report CRITICAL or HIGH level issues. You need take action for it manually.

Option: You can also disable the security Hub controls (but not recommended).

- https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-enable-disable-controls.html

## 1. Set MFA to Root user

You need to set MFA for root user manually. "root user" is a user using email address to login management console.

Security Hub controls related to MFA(CRITICAL level)

- [CIS.1.13] Ensure MFA is enabled for the "root" account
  - https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-1.13
- [CIS.1.14] Ensure hardware MFA is enabled for the "root" account
  - https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-1.14
- [IAM.6] Hardware MFA should be enabled for the root user
  - https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-iam-6

How to remediate:

1. Access to root user on Organizations member account.

- https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_access.html#orgs_manage_accounts_access-as-root

2. Enable hardware MFA for root user

- https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable_physical.html#enable-hw-mfa-for-root

## 2. Use IDMSv2 to access EC2 metadata

You need to use IDMSv2 only for EC2 instances. Take a look the document below for remediation.

- [EC2.8] EC2 instances should use IMDSv2
  - https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-ec2-8

# Appendix. A: Deploy via CloudShell

Deploy BLEA via CloudShell on AWS Console.  
Please note that CloudShell will delete environment if you do not use that for 120 days.  
see: https://docs.aws.amazon.com/cloudshell/latest/userguide/limits.html

## 0. Open CloudShell

- Open CloudShell from [>_] icon on your AWS console (top right, near by account name)
  ![OpenConsole](/doc/images/OpenConsole.png)

## 1. Setup CDK prerequisities

See: https://docs.aws.amazon.com/ja_jp/cdk/latest/guide/getting_started.html

- Update npm

```
$ sudo npm -g install npm
```

- TypeScript 2.7 or later

```
$ sudo npm -g install typescript
```

- CDK 1.97.0 or later

```
$ sudo npm install -g aws-cdk
```

- ncu

```
$ sudo npm install -g npm-check-updates
```

## 2. Upload and extract BLEA file

- Get BLEA source file from git or your SA
- Upload BLEA file from [Action]-[Upload File] Button
  ![UploadFiles](/doc/images/UploadFiles.png)

- Extract and delete uploaded file

```
$ unzip baseline-template-vx.x.x.zip
$ rm baseline-template-vx.x.x.zip
```

## 3. Build

```
$ cd path-to-source
$ ncu -u
$ npm install
$ npm run build
```

if npm install doesn’t work, remove package-lock.json first.

```
$ cd <path-to-source>
$ ncu -u
$ rm package-lock.json
$ npm install
$ npm run build
```

# Appendix.B Setup Slack for AWS Chatbot

To send alarms to slack, create BLEA-ChatbotSecurity and BLEA-ChatbotMonitor stack.
Before create these stack, you need to set up chat client for AWS Chatbot or stack creation will be failed.

Stack creating procedure is discribed below.

## 1. Create your workspace and channel on Slack

(This is an operation on Slack) Create workspace and channel you want to receive message.
Remember Slack channel ID (You can copy the channel ID with "Copy Link"). It looks like https://your-work-space.slack.com/archives/C01XXXXXXXX. `C01XXXXXXXX` is the channel ID.

## 2. Setup chat client for AWS Chatbot

- Follow the steps 1-4 of "Setting up AWS Chatbot with Slack". It just create Slack workspaces on AWS Chatbot.
  - https://docs.aws.amazon.com/chatbot/latest/adminguide/getting-started.html

## 3. Edit your workspace ID and channel ID on context file

cdk.json or cdk.context.json:

```
      "slackNotifier": {
        "workspaceId": "T8XXXXXXX",
        "channelIdSec": "C01XXXXXXXX",
        "channelIdMon": "C01YYYYYYYY"
      }
```

- workspaceId: Copy from AWS Chatbot Workspace details
- channelIdSec: Copy from Your Slack App - Security Alarms
- channelIdMon: Copy from Your Slack App - Monitoring Alarms
