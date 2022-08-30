# Sample Web application - Architecture diagram

## Sample Web application (ECS)

![ECS](../../doc/images/BLEA-GuestSampleWebECS.png)

- bin/blea-guest-ecsapp-sample.ts
  - ECS/Fargate + AuroraPostgreSQL
- bin/blea-guest-ecsapp-sample-pipeline.ts
  - CI/CD of this system by CDK Pipelines.
  - [How to deploy](../../doc/PipelineDeployment.md)

## Sample Web application (ECS+SSL)

![ECS-and-SSL](../../doc/images/BLEA-GuestSampleWebECSSSL.png)

- bin/blea-guest-ecsapp-ssl-sample.ts
  - ECS/Fargate + AuroraPostgreSQL
  - With SSL Certificate for your domain

## Sample Web application (Autoscaling Group)

![ASG](../../doc/images/BLEA-GuestSampleWebASG.png)

- bin/blea-guest-asgapp-sample.ts
  - EC2 Autoscaling Group + Aurora PostgreSQL

## Sample Web application (EC2)

![EC2](../../doc/images/BLEA-GuestSampleWebEC2.png)

- bin/blea-guest-ec2app-sample.ts
  - EC2 + AuroraPostgreSQL
