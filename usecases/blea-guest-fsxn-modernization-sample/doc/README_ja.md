# BLEA ゲストシステム: FSxN モダナイゼーションプラットフォーム

## 概要

VMware/オンプレミスからAWSへの移行時に、Amazon FSx for NetApp ONTAP を共有ストレージ基盤として活用するパターンです。コンピュートパターン（EC2/ECS/EKS/Lambda/Batch）は parameter.ts でモジュラーに選択できます。

## アーキテクチャ

```
┌──────────────────────────────────────────────────────────────────────┐
│ VPC (Isolated Subnet、Internet Gateway / NAT なし)                    │
│                                                                       │
│  ┌─── 常にデプロイされる ─────────────────────────────────────────┐  │
│  │  FSx for NetApp ONTAP (共有ストレージ)                          │  │
│  │  ├── NFS Volume (/shared) ──────── EC2、Batch がマウント        │  │
│  │  └── S3 Access Point ───────────── Lambda、ECS が API 呼び出し   │  │
│  │                                                                  │  │
│  │  CapacityManager (自動拡張)  ·  AWS Backup (日次)                │  │
│  │  CloudWatch Alarm 3個 + SNS  ·  KMS CMK                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ▲                                        │
│         1 つのボリューム、5 通りのアクセス方法                        │
│                              │                                        │
│  ┌─── parameter.ts の Toggle で選択 ───────────────────────────────┐  │
│  │                                                                  │  │
│  │  [EC2 ASG]    [Lambda]     [ECS Fargate]  [EKS]      [Batch]    │  │
│  │   NFS mount    S3 AP        S3 AP          Trident    NFS mount │  │
│  │                                             CSI PV              │  │
│  │      ▲            ▲             ▲             ▲          ▲     │  │
│  │  enableEc2   enableLambda   enableEcs    enableEks  enableBatch │  │
│  │   Pattern      Pattern       Pattern      Pattern     Pattern   │  │
│  │                                                                  │  │
│  │  false の場合は construct が生成されず、リソースは作られない      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## コンピュートパターン

| パターン        | アクセス方式         | ユースケース            | Toggle                |
| --------------- | -------------------- | ----------------------- | --------------------- |
| **EC2**         | NFS mount (NFSv4.1)  | レガシーアプリ、VM 移行 | `enableEc2Pattern`    |
| **ECS Fargate** | S3 AP (VPC-origin)   | コンテナ化バッチ        | `enableEcsPattern`    |
| **EKS**         | Trident CSI (NFS PV) | Kubernetes ワークロード | `enableEksPattern`    |
| **Lambda**      | S3 AP (VPC-origin)   | サーバーレス処理        | `enableLambdaPattern` |
| **Batch**       | NFS mount (EC2)      | 大規模バッチ、Spot      | `enableBatchPattern`  |

> **ECS Fargate の注意**: Fargate は FSxN NFS を直接マウント**できません**。S3 AP 経由でデータにアクセスします。POSIX ファイル操作が必要な場合は EC2 パターンを使用してください。

### Toggle の仕組み

ストレージ層は一度だけデプロイされ、全パターンで共有されます。各コンピュートパターンは独立した construct で、Toggle が `true` のときだけスタックが生成します。無効なパターンはリソースを**一切**作らないため、削除作業も課金も発生しません。

Toggle は `parameter.ts` で設定します。

```ts
export const devParameter: AppParameter = {
  // ... ストレージ・監視の設定 ...

  enableEc2Pattern: true, // Auto Scaling group から NFS マウント
  enableLambdaPattern: true, // Lambda から S3 Access Point 経由でアクセス
  enableEcsPattern: false, // デプロイされない
  enableEksPattern: false, // デプロイされない
  enableBatchPattern: false, // デプロイされない
};
```

スタック側はこれをそのまま参照します。

```ts
if (props.enableEc2Pattern) {
  new ComputeEc2(this, 'ComputeEc2', { ... });
}
```

Toggle を変更して `npx cdk deploy` を再実行すると、そのパターンが追加または削除されます。FSx for ONTAP のファイルシステム、NFS ボリューム、S3 Access Point は影響を受けないため、**データはそのままでコンピュート側だけが入れ替わります**。これがこのサンプルの主眼です。ストレージを移行せずに、ワークロードを EC2 からコンテナへ移すことができます。

### 各 Toggle が追加するもの

Toggle に関係なく常にデプロイされるもの:

- FSx for ONTAP ファイルシステム、SVM、NFS ボリューム、S3 Access Point
- KMS CMK、Isolated Subnet の VPC、セキュリティグループ
- S3 Gateway Endpoint、CloudWatch Logs Interface Endpoint
- CapacityManager（自動拡張）、AWS Backup プラン、CloudWatch Alarm 3 個 + SNS

各 Toggle は自身のリソースのみを追加します。

| Toggle                | 追加されるもの                                   | 追加される VPC Endpoint    |
| --------------------- | ------------------------------------------------ | -------------------------- |
| `enableEc2Pattern`    | Auto Scaling group、起動テンプレート、IAM ロール | SSM、SSM Messages          |
| `enableLambdaPattern` | Lambda 関数、S3 AP に限定した IAM ロール         | なし                       |
| `enableEcsPattern`    | ECS クラスター、Fargate サービス、タスク定義     | ECR、ECR Docker            |
| `enableEksPattern`    | EKS クラスター（L1 `CfnCluster`）、IAM ロール    | なし（Trident は手動導入） |
| `enableBatchPattern`  | Batch コンピュート環境、ジョブキュー、ジョブ定義 | なし                       |

実測した CloudFormation リソース数（`cdk synth`、`SINGLE_AZ_1`）:

| 構成                                                 | リソース数 | VPC Endpoint 数 |
| ---------------------------------------------------- | ---------- | --------------- |
| 全パターン OFF（ストレージのみ）                     | 32         | 2               |
| EC2 のみ                                             | 40         | 4               |
| EC2 + Lambda（`devParameter` の既定）                | 44         | 4               |
| EC2 + Lambda + ECS + Batch（`prodParameter` の既定） | 64         | 6               |
| 全 5 パターン ON                                     | 66         | 6               |

EKS の追加が 2 リソースのみなのは、クラスターが L1 `CfnCluster` であるためです。ノードグループと Trident CSI ドライバーは別途導入します（後述）。

### 段階的な導入例

Toggle は、移行の各段階でスタックを作り直さずに追い付けるようにするためのものです。典型的な流れは次のとおりです。

| 段階                         | ON にする Toggle        | 得られる状態                                               |
| ---------------------------- | ----------------------- | ---------------------------------------------------------- |
| 1. VMware からリフト＆シフト | `enableEc2Pattern`      | EC2 が NFS ボリュームをマウント。アプリコードは変更不要    |
| 2. サーバーレス処理を追加    | `+ enableLambdaPattern` | Lambda が S3 Access Point 経由で同じデータを読む。NFS 不要 |
| 3. コンテナ化                | `+ enableEcsPattern`    | Fargate タスクが EC2 群と並行して S3 Access Point を使用   |
| 4. 定期バッチを追加          | `+ enableBatchPattern`  | Batch が EC2 起動タイプで NFS マウント。Spot も選択可      |
| 5. Kubernetes へ移行         | `+ enableEksPattern`    | EKS が Trident CSI 経由で同じボリュームをマウント          |

どの段階でも、それ以前のパターンは動作し続けます。すべてが 1 つの FSx for ONTAP ボリュームを参照しているためです。段階 1 と段階 5 は同じファイルを読みます。

### ECS Fargate 本番化手順

デフォルトでは `desiredCount: 0` でデプロイされます。本番化する場合:

1. ECR VPC Endpoint が有効であることを確認（`enableEcsPattern: true` で自動作成）
2. Private ECR にコンテナイメージをプッシュ（Public ECR は VPC Endpoint 非対応）
3. `parameter.ts` の `desiredCount` を 1 以上に設定
4. `npx cdk deploy` で更新

> ⏱️ 初回デプロイには 20〜35 分程度かかります。所要時間の大部分は FSx for ONTAP ファイルシステムのプロビジョニングです。

## コスト見積もり

概算です。実際の見積もりは対象リージョンと構成で AWS Pricing Calculator を使って確認してください。

| 構成                                           | 月額 (USD) |
| ---------------------------------------------- | ---------- |
| 最小 (FSxN + EC2 + Lambda、`devParameter`)     | ~$550      |
| フル (全パターン ON、`prodParameter` のサイズ) | ~$2,000    |

Interface Endpoint は「エンドポイント数 × AZ 数」で課金され、S3 Gateway Endpoint は無料です。このサンプルでは全パターン OFF で Interface Endpoint 1 個、EC2 ON で 3 個、EC2 と ECS 両方 ON で 5 個になります。

## 期待される効果

| 指標               | Before (VMware)    | After (AWS + FSxN)       |
| ------------------ | ------------------ | ------------------------ |
| ストレージ管理工数 | 手動運用           | CapacityManager 自動拡張 |
| データコピー       | サービスごとに複製 | 単一ストレージ共有       |
| Dev/Test 環境作成  | 数時間             | FlexClone で即時         |
| コスト効率         | 固定インフラ       | FabricPool + Spot        |

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
