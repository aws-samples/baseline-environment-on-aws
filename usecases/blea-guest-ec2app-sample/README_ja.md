# Web アプリケーションサンプルアーキテクチャ図

## Web アプリケーションサンプル (ECS)

![ECS](../../doc/images/BLEA-GuestSampleWebECS.png)

- bin/blea-guest-ecsapp-sample.ts
  - ECS/Fargate+AuroraPostgreSQL を使ったサンプルシステム
- bin/blea-guest-ecsapp-sample-pipeline.ts
  - 上の構成に対して CDK Pipelines を用いた CI/CD を行うサンプルシステム。
  - 詳細は[こちら](../../doc/PipelineDeployment_ja.md)

## Web アプリケーションサンプル (ECS+SSL)

![ECS-and-SSL](../../doc/images/BLEA-GuestSampleWebECSSSL.png)

- bin/blea-guest-ecsapp-ssl-sample.ts
  - ECS/Fargate+AuroraPostgreSQL を使ったサンプルシステム
  - 独自ドメインによる SSL 証明書対応

## Web アプリケーションサンプル (Autoscaling Group)

![ASG](../../doc/images/BLEA-GuestSampleWebASG.png)

- bin/blea-guest-asgapp-sample.ts
  - EC2 Autoscaling Group+AuroraPostgreSQL を使ったサンプルシステム

## Web アプリケーションサンプル (EC2)

![EC2](../../doc/images/BLEA-GuestSampleWebEC2.png)

- bin/blea-guest-ec2app-sample.ts
  - EC2+AuroraPostgreSQL を使ったサンプルシステム
