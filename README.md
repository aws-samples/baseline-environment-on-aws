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


# 4. How to Deploy Guardrail (For test. It's usually deployed by ControlTower on production)
You need to specify `--profile your_profile_name` on all of steps below. Each stacks are independent each other.
```
$ cdk deploy ABLE-Trail 
$ cdk deploy ABLE-ConfigRule
$ cdk deploy ABLE-ConfigCtGuardrail
$ cdk deploy ABLE-Guardduty
$ cdk deploy ABLE-SecurityHub
$ cdk deploy ABLE-SecurityAlarm
```

# 5. How to deploy sample apps
You need to specify `--profile your_profile_name` on all of steps below.
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

1. Enable hardware MFA for root user
* https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable_physical.html#enable-hw-mfa-for-root


### 4-2. Use IDMSv2 to access EC2 metadata
You need to use IDMSv2 only for EC2 instances. Take a look the document below for remediation.

* [EC2.8] EC2 instances should use IMDSv2
  * https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-ec2-8



# 5. Send alarm to Slack
To send alarms to slack, create ABLE-ChatbotSecurity and ABLE-ChatbotMonitor stack.
Before create these stack, you need to set up chat client for AWS Chatbot or stack creation will be failed.

Stack creating procedure is discribed below.

1. Create your workspace and channel on Slack.
(This is an operation on Slack) Create workspace and channel you want to receive message.
Remember Slack channel ID (You can copy the channel ID with "Copy Link"). It looks like https://your-work-space.slack.com/archives/C01R4THXXXX. "C01R4THXXXX" is the channel ID.

2. Setup chat client for AWS Chatbot
* Follow the steps 1-4 of "Setting up AWS Chatbot with Slack". It just create Slack workspaces on AWS Chatbot.
  * https://docs.aws.amazon.com/ja_jp/chatbot/latest/adminguide/getting-started.html

3. Edit your workspace ID and channel ID on ABLE template.
on able-app.ts, you need to update these parameters for your environment.
```
const workspaceId = 'T8XXXXXXX';     // Copy from AWS Chatbot Workspace details
const channelIdSec = 'C01XXXXXXXX';  // Copy from Your Slack App - Security Alarms
const channelIdMon = 'C01YYYYYYYY';  // Copy from Your Slack App - Monitoring Alarms
```

3. Deploy Chatbot Stack.
```
$ cdk deploy ABLE-ChatbotSecurity
$ cdk deploy ABLE-ChatbotMonitor
```
* ABLE-ChatbotSecurity is for security alarm topic.
* ABLE-ChatbotMonitor is for monitoring alarm topic.

