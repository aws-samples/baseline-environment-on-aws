# Web アプリケーションサンプルアーキテクチャ図

## Web アプリケーションサンプル (ECS+SSL)

![ECS-and-SSL](../../doc/images/BLEA-GuestSampleWebECSSSL.png)

- usecase/bin/blea-guest-ecsapp-sample.ts
  - ECS/Fargate+AuroraPostgreSQL を使ったサンプルシステム
  - 独自ドメインによる SSL 証明書対応
- usecase/bin/blea-guest-ecsapp-sample-via-cdk-pipelines.ts
  - 上の構成に対して CDK Pipelines を用いた CI/CD を行うサンプルシステム。
  - 詳細は[こちら](../../doc/PipelineDeployment_ja.md)

## Web アプリケーションサンプル (EC2)

- usecase/blea-guest-ec2app-sample
  - EC2 Autoscaling Group/EC2 +AuroraPostgreSQL を使ったサンプルシステム

![ASG](../../doc/images/BLEA-GuestSampleWebASG.png)
![EC2](../../doc/images/BLEA-GuestSampleWebEC2.png)
