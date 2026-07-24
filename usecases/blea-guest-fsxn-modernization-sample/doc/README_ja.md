# BLEA ゲストシステム: FSxN モダナイゼーションプラットフォーム

## 概要

VMware/オンプレミスからAWSへの移行時に、Amazon FSx for NetApp ONTAP を共有ストレージ基盤として活用するパターンです。コンピュートパターン（EC2/ECS/EKS/Lambda/Batch）は parameter.ts でモジュラーに選択できます。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│ VPC (Private Subnets, No Internet)                       │
│                                                          │
│  FSx for NetApp ONTAP (共有ストレージ)                    │
│  ├── NFS Volume (/shared)  → EC2, Batch                 │
│  └── S3 Access Point       → Lambda, ECS (Fargate)      │
│                                                          │
│  [EC2 ASG]  [ECS Fargate]  [EKS]  [Lambda]  [Batch]   │
│   NFS mount   S3 AP API   Trident  S3 AP    NFS mount  │
│                CSI PV                                    │
│                                                          │
│  ServerlessOps: CapacityManager (auto-expand)            │
│  DataProtection: AWS Backup (daily)                      │
│  Monitoring: 3 Alarms + SNS                             │
└─────────────────────────────────────────────────────────┘
```

## コンピュートパターン

| パターン | アクセス方式 | ユースケース | Toggle |
|---------|------------|------------|--------|
| **EC2** | NFS mount (NFSv4.1) | レガシーアプリ、VM 移行 | `enableEc2Pattern` |
| **ECS Fargate** | S3 AP (VPC-origin) | コンテナ化バッチ | `enableEcsPattern` |
| **EKS** | Trident CSI (NFS PV) | Kubernetes ワークロード | `enableEksPattern` |
| **Lambda** | S3 AP (VPC-origin) | サーバーレス処理 | `enableLambdaPattern` |
| **Batch** | NFS mount (EC2) | 大規模バッチ、Spot | `enableBatchPattern` |

> **ECS Fargate の注意**: Fargate は FSxN NFS を直接マウント**できません**。S3 AP 経由でデータにアクセスします。POSIX ファイル操作が必要な場合は EC2 パターンを使用してください。

### ECS Fargate 本番化手順

デフォルトでは `desiredCount: 0` でデプロイされます。本番化する場合:

1. ECR VPC Endpoint が有効であることを確認（`enableEcsPattern: true` で自動作成）
2. Private ECR にコンテナイメージをプッシュ（Public ECR は VPC Endpoint 非対応）
3. `parameter.ts` の `desiredCount` を 1 以上に設定
4. `npx cdk deploy` で更新

> ⏱️ 初回デプロイには 20〜35 分程度かかります。所要時間の大部分は FSx for ONTAP ファイルシステムのプロビジョニングです。

## コスト見積もり

| 構成 | 月額 (USD) |
|------|-----------|
| 最小 (FSxN + EC2 + Lambda) | ~$550 |
| フル (全パターン ON) | ~$2,000 |
| VPC Endpoint (8個 × 2AZ) | ~$115 |

## 期待される効果

| 指標 | Before (VMware) | After (AWS + FSxN) |
|------|-----------------|-------------------|
| ストレージ管理工数 | 手動運用 | CapacityManager 自動拡張 |
| データコピー | サービスごとに複製 | 単一ストレージ共有 |
| Dev/Test 環境作成 | 数時間 | FlexClone で即時 |
| コスト効率 | 固定インフラ | FabricPool + Spot |

## EKS + Trident CSI 設定手順

CDK デプロイ後、以下を手動実行:

```bash
# 1. Trident インストール
helm repo add netapp-trident https://netapp.github.io/trident-helm-chart
helm install trident netapp-trident/trident-operator -n trident --create-namespace

# 2. Backend 設定
kubectl apply -f - <<EOF
apiVersion: trident.netapp.io/v1
kind: TridentBackendConfig
metadata:
  name: fsxn-backend
  namespace: trident
spec:
  version: 1
  storageDriverName: ontap-nas
  managementLIF: <SVM-MANAGEMENT-ENDPOINT>
  dataLIF: <SVM-NFS-ENDPOINT>
  svm: svm-platform
  credentials:
    name: fsxn-secret
EOF

# 3. StorageClass 作成
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fsxn-sc
provisioner: csi.trident.netapp.io
parameters:
  backendType: ontap-nas
EOF
```

## ライセンス

MIT-0
