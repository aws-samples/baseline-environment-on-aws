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
* cdk synth

3. How to Deploy Guardrail (For test. It's usually deployed by ControlTower on production)
* cdk deploy bs-guardduty --require-approval never
* cdk deploy bs-trail --require-approval never
* cdk deploy bs-config-rules --require-approval never
* cdk deploy bs-iam --require-approval never

4. How to deploy sample apps
* Deploy baseline(CMK, LogBucket, VPC) and EC2 Web Apps (Autoscaling)
  * cdk deploy bs-ec2app-stack --require-approval never
* Deploy Aurora (it takes 15mins)
  * cdk deploy BsDbStack -stack --require-approval never
* (Option) Deploy EC2 Web Apps (Individual instances) on baseline
  * cdk deploy bs-ec2app-simple-stack --require-approval never
