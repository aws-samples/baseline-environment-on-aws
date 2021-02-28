# baseline-template
# CDK template for Multiaccount management with Control Tower

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
$ cdk deploy GcTrail 
$ cdk deploy GcConfigCtGuardrail
$ cdk deploy GcGuardduty
$ cdk deploy GcSecurityHub
$ cdk deploy GcSecurityAlarm
```

# 5. How to deploy sample apps
You need to specify `--profile your_profile_name` on all of steps below.
## 1. Deploy roles to operate the apps.
```
$ cdk deploy GcIam 
```

## 2. Deploy Application Stack (baseline will be deployed as dependency)
```
$ cdk deploy GcEc2app
or 
$ cdk deploy GcEc2AppSimple
or 
$ cdk deploy GcFargate
```
* `GcEc2app` Stack - Deploy EC2 Web Apps (with AutoScaling) on baseline.
* `GcEc2AppSimple` Stack - Deploy EC2 Web Apps (No AutoScaling) on baseline. 
* `GcFargate`  Stack  - To eploy Fargate Apps on baseline.
* Baseline stacks to be deployed as dependency
  * `GcMonitorAlarm GcGeneralLogKey GcGeneralLog GcFlowlogKey GcFlowLog GcVpc`

## 3. Deploy Database (this step takes 15mins)
```
$ cdk deploy GcDb
or 
$ cdk deploy GcAuroraServerless
```
* `GcDb` - Deploy Aurora PostgreSQL on baseline
* `GcAuroraServerless` - Deploy Aurora Serverless on baseline

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


### 3-2. Use IDMSv2 to access EC2 metadata
You need to use IDMSv2 only for EC2 instances. Take a look the document below for remediation.

* [EC2.8] EC2 instances should use IMDSv2
  * https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-ec2-8



