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
