# baseline-template
# CDK template for Multiaccount management with Control Tower

## How to Deploy
1. Setup CDK prerequisities
See: https://docs.aws.amazon.com/ja_jp/cdk/latest/guide/getting_started.html
* TypeScript 2.7 or later
  * npm -g install typescript
* CDK 1.89.0 or later
  * npm install -g aws-cdk
* ncu
  * npm install -g npm-check-updates


2. Build
* cd path-to-source
* ncu -u
* npm install
* npm run build

3. BootStrap Account & Region
* Setup AWS Credentials and Region
  * ~/.aws/credentials
    * [your_profile_dev] 
      aws_access_key_id = XXXXXXXXXXXXXXX
      aws_secret_access_key = YYYYYYYYYYYYYYY
      region = ap-northeast-1
    * [your_profile_prod]
      aws_access_key_id = ZZZZZZZZZZZZZZZZ
      aws_secret_access_key = PPPPPPPPPPPPPPPP
      region = ap-northeast-1
* Use cdk with --profile option
  * For dev,  "cdk bootstrap --profile your_profile_dev"
  * For prod, "cdk bootstrap --profile your_profile_prod"

4. How to Deploy Guardrail (For test. It's usually deployed by ControlTower on production)
If you don't want to respond to approval, add an option "--require-approval never" (but be careful).
You need to specify "--profile your_profile_name" on all of steps below.
* cdk deploy BsTrail 
* cdk deploy BsConfigCtGuardrail
* cdk deploy BsGuardduty
* cdk deploy BsSecurityHub
* cdk deploy BsIam 

5. How to deploy sample apps
* Deploy baseline(CMK, LogBucket, VPC) and EC2 Web Apps (Autoscaling)
  * cdk deploy BsEc2app
* Deploy Aurora (this step takes 15mins)
  * cdk deploy BsDb
* (Option) Deploy EC2 Web Apps (Individual instances) on baseline
  * cdk deploy BsEc2appSimple
* (Option) Deploy Fargate Apps on baseline
  * cdk deploy BsAlbFargate
