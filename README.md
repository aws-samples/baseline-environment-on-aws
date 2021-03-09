# ABLE - AWS BaseLine Environment CDK Template

## How to Deploy
# 1. Setup CDK prerequisities

See: https://docs.aws.amazon.com/ja_jp/cdk/latest/guide/getting_started.html

* TypeScript 2.7 or later
```
npm -g install typescript
```
* CDK 1.90.1 or later
```
npm install -g aws-cdk
``` 
* ncu
```
npm install -g npm-check-updates
```

# 2. Build
```
cd path-to-source
ncu -u
npm install
npm run build
```

# 3. BootStrap Account & Region
## 1.Setup AWS Credentials and Region
```
$ vi ~/.aws/credentials

[your_profile_dev] 
aws_access_key_id = XXXXXXXXXXXXXXX
aws_secret_access_key = YYYYYYYYYYYYYYY
rgion = ap-northeast-1

[your_profile_prod]
aws_access_key_id = ZZZZZZZZZZZZZZZZ
aws_secret_access_key = PPPPPPPPPPPPPPPP
region = ap-northeast-1
```
## 2.Bootstrap your account & region
```
cdk bootstrap
```

> Tips
> * Use cdk with `--profile` option. Example:
>   * For dev account:  `cdk bootstrap --profile your_profile_dev`
>   * For prod account: `cdk bootstrap --profile your_profile_prod`
> * If you don't want to block deploy process with approval, add an option `--require-approval never` (but be careful!).


# 4. Define parameters in CDK Context
You need to define deployment parameters on CDK Context. Context values are defined in cdk.json file or cdk.context.json file or -c option.
* See: https://docs.aws.amazon.com/ja_jp/cdk/latest/guide/context.html
* See: https://docs.aws.amazon.com/ja_jp/cdk/latest/guide/get_context_var.html

## 1. Sample cdk.json and cdk.context.json:
These files are define `dev`, `prod`, `my` context. cdk.json is managed by git. cdk.context.json is managed just for your local environmen only.
```
$ cat cdk.json
{
  "app": "npx ts-node bin/able-app.ts",
  "context": {
    "dev": {
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
    }
  }
}
```

You need to create cdk.context.json by yourself (might be generated automatically). This file is ignored by git.
```
$ cat cdk.context.json
{
  "@aws-cdk/core:enableStackNameDuplicates": "true",
  "aws-cdk:enableDiffNoFail": "true",
  "@aws-cdk/core:stackRelativeExports": "true",
  "my": {
    "envName": "Personal",
    "vpcCidr": "10.100.0.0/16",
    "securityNotifyEmail": "xxx@example.com",
    "monitoringNotifyEmail": "zzz@example.com",
    "dbUser": "personaluser",
    "slackNotifier": {
      "workspaceId": "T8PERSONAL",
      "channelIdSec": "C01PERSONAL",
      "channelIdMon": "C02PERSONAL"
    }
  }
}
```

## 2. Use parameters in CDK code
You can use parameters like this. This code intend to use context optioin in cdk command with `-c environment=dev`
```
const envKey = app.node.tryGetContext('environment'); 
const valArray = app.node.tryGetContext(envKey);
const environment_name = valArray['envName'];
```


## 3. Deploy stack with context parameters
```
$ cdk deploy ABLE-ECSApp --profile your_profile_dev --require-approval never -c environment=dev
$ cdk deploy ABLE-ECSApp --profile your_profile_prod --require-approval never -c environment=prod
$ cdk deploy ABLE-ECSApp --profile your_profile_mine --require-approval never -c environment=my
```



# 5. How to Deploy Guardrail (For test. It's usually deployed by ControlTower on production)
You need to specify `--profile your_profile_name -c environment=xxx` on all of steps below. Each stacks are independent each other.
```
$ cdk deploy ABLE-Trail 
$ cdk deploy ABLE-ConfigRule
$ cdk deploy ABLE-ConfigCtGuardrail
$ cdk deploy ABLE-Guardduty
$ cdk deploy ABLE-SecurityHub
$ cdk deploy ABLE-SecurityAlarm
```

# 6. How to deploy sample apps
You need to specify `--profile your_profile_name -c environment=xxx` on all of steps below.
## 1. Deploy roles to operate the apps.
```
$ cdk deploy ABLE-Iam 
```

## 2. Deploy Application Stack (baseline will be deployed as dependency)
```
$ cdk deploy ABLE-ASGApp
or 
$ cdk deploy ABLE-EC2App
or 
$ cdk deploy ABLE-ECSApp
```
* `ABLE-ASGApp` Stack - Deploy EC2 Web Apps (with AutoScaling) on baseline.
* `ABLE-EC2App` Stack - Deploy EC2 Web Apps (No AutoScaling) on baseline. 
* `ABLE-ECSApp`  Stack  - To eploy Fargate Apps on baseline.
* Baseline stacks to be deployed as dependency
  * `ABLE-MonitorAlarm ABLE-GeneralLogKey ABLE-GeneralLog ABLE-FlowlogKey ABLE-FlowLog ABLE-Vpc`

## 3. Deploy Database (this step takes 15mins)
```
$ cdk deploy ABLE-DBAuroraPg
or 
$ cdk deploy ABLE-DBAuroraPgSl
```
* `ABLE-DBAuroraPg` - Deploy Aurora PostgreSQL on baseline
* `ABLE-DBAuroraPgSl` - Deploy Aurora Serverless on baseline

## 4. Remediate 
Some SecurityHub benchmark report CRITICAL or HIGH level issues. You need take action for it manually.

Option: You can also disable the security Hub controls (but not recommended).
* https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-enable-disable-controls.html


### 4-1. Set MFA to Root user
You need to set MFA for root user manually. "root user" is a user using email address to login management console.

Security Hub controls related to MFA(CRITICAL level)
* [CIS.1.13] Ensure MFA is enabled for the "root" account
  * https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-1.13
* [CIS.1.14] Ensure hardware MFA is enabled for the "root" account
  * https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-1.14
* [IAM.6] Hardware MFA should be enabled for the root user
  * https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-iam-6

How to remediate:
1. Access to root user on Organizations member account.
* https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_accounts_access.html#orgs_manage_accounts_access-as-root

2. Enable hardware MFA for root user
* https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable_physical.html#enable-hw-mfa-for-root


### 4-2. Use IDMSv2 to access EC2 metadata
You need to use IDMSv2 only for EC2 instances. Take a look the document below for remediation.

* [EC2.8] EC2 instances should use IMDSv2
  * https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-ec2-8



# 7. Send alarm to Slack
To send alarms to slack, create ABLE-ChatbotSecurity and ABLE-ChatbotMonitor stack.
Before create these stack, you need to set up chat client for AWS Chatbot or stack creation will be failed.

Stack creating procedure is discribed below.

## 1. Create your workspace and channel on Slack
(This is an operation on Slack) Create workspace and channel you want to receive message.
Remember Slack channel ID (You can copy the channel ID with "Copy Link"). It looks like https://your-work-space.slack.com/archives/C01R4THXXXX. "C01R4THXXXX" is the channel ID.

## 2. Setup chat client for AWS Chatbot
* Follow the steps 1-4 of "Setting up AWS Chatbot with Slack". It just create Slack workspaces on AWS Chatbot.
  * https://docs.aws.amazon.com/ja_jp/chatbot/latest/adminguide/getting-started.html

## 3. Edit your workspace ID and channel ID on context file
cdk.json or cdk.context.json: 
```
      "slackNotifier": {
        "workspaceId": "T8XXXXXXX",
        "channelIdSec": "C01XXXXXXXX",
        "channelIdMon": "C01YYYYYYYY"
      }
```
* workspaceId: Copy from AWS Chatbot Workspace details
* channelIdSec: Copy from Your Slack App - Security Alarms
* channelIdMon: Copy from Your Slack App - Monitoring Alarms


## 4. Deploy Chatbot Stack
```
$ cdk deploy ABLE-ChatbotSecurity
$ cdk deploy ABLE-ChatbotMonitor
```
* ABLE-ChatbotSecurity is for security alarm topic.
* ABLE-ChatbotMonitor is for monitoring alarm topic.

