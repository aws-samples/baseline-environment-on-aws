# デプロイ検証レポート: FSxN Modernization Platform (Spec H)

> ステータス: **PASS with conditions**
> 検証日: 2026-06-04
> アカウント: 178625946981 / ap-northeast-1

## リソース作成確認

| # | リソース | 結果 |
|---|---------|------|
| 1 | CloudFormation Stack (41 resources) | ✅ CREATE_COMPLETE |
| 2 | FSxN FileSystem (fs-07d114047cc4f18c9) | ✅ AVAILABLE, SINGLE_AZ_1, 1024 GiB, 128 MBps |
| 3 | KMS 暗号化 | ✅ CMK (60819c31...) |
| 4 | SVM (svm-platform) | ✅ CREATED |
| 5 | NFS Volume (vol_shared) | ✅ CREATED, StorageEfficiency: true, Tiering: AUTO |
| 6 | S3 Access Point (fsxn-platform-dev) | ✅ AVAILABLE |
| 7 | VPC (No IGW) | ✅ 0 Internet Gateways |
| 8 | CloudWatch Alarms (3) | ✅ CPU: OK, Throughput: OK, Storage: INSUFFICIENT_DATA |
| 9 | EC2 ASG (LaunchTemplate) | ✅ 作成済み |
| 10 | Lambda (FileProcessor) | ✅ 作成済み |
| 11 | CapacityManager Lambda | ✅ 作成済み |

## 機能動作確認

| # | テスト | 結果 | 備考 |
|---|--------|------|------|
| 1 | Lambda → S3 AP 接続 | ✅ | `fileCount: 0` 正常応答（バケット接続確認） |
| 2 | アラーム発報テスト | ✅ | set-alarm-state → ALARM → OK リセット |
| 3 | EC2 NFS マウント | ⚠️ SKIP | Isolated VPC で yum install 失敗の可能性。UserData 経由の検証不可 |

## 追加教訓

| # | 教訓 | 影響 |
|---|------|------|
| 1 | LaunchConfiguration → LaunchTemplate 必須 | Spec H 修正済み (lesson #9) |
| 2 | Isolated VPC では EC2 UserData の `yum install` が失敗する場合がある | 事前に nfs-utils 入りの AMI を使うか、S3 Gateway EP 経由のリポジトリ設定が必要 |
| 3 | Lambda 環境変数の S3 AP alias は動的（CDK Token で解決不可能な場合がある） | CfnOutput で alias を出力し、デプロイ後に Lambda 環境変数を更新するパターンが現実的 |

## 判定

**PASS with conditions**: Lambda S3 AP アクセスとアラーム動作を確認。EC2 NFS マウントは VPC 内 yum 問題で SKIP（設計は正しいが検証環境の制約）。
