# BLEA ゲストシステム: FSx for NetApp ONTAP データ分析サンプル

## 概要

このユースケースは、Amazon FSx for NetApp ONTAP をエンタープライズファイルストレージとして導入し、S3 Access Point 経由で AWS Glue および Amazon Athena と統合するパターンを提供します。ファイルデータの複製なしに SQL ベースの分析を実現します。

## アーキテクチャ

![アーキテクチャ図](images/architecture.png)

```
┌────────────────────────────────────────────────────────────────────┐
│ BLEAFsxnDataAnalyticsStack                                          │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ VPC (プライベートサブネット × 2 AZ、インターネット非接続)         │  │
│  │  VPC Endpoint: S3 (Gateway), Glue, Athena                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────┐   ┌──────────────────────────────────┐   │
│  │ FSx for ONTAP        │   │ S3 Access Point                  │   │
│  │  ├── File System     │──►│  (Internet-origin)               │   │
│  │  │   (Multi-AZ)      │   │  UNIX_USER identity              │   │
│  │  ├── SVM             │   └──────────────┬───────────────────┘   │
│  │  └── Volume (NFS)    │                  │                       │
│  │      Dedup + 圧縮    │                  ▼                       │
│  │      FabricPool       │   ┌──────────────────────────────────┐   │
│  └─────────────────────┘   │ データ分析                         │   │
│                             │  Glue Crawler → Data Catalog       │   │
│                             │  Athena Workgroup → SQL クエリ     │   │
│                             │  結果 → S3 Bucket (KMS 暗号化)    │   │
│                             └──────────────────────────────────┘   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ モニタリング                                                   │  │
│  │  CloudWatch アラーム → SNS → Email + Chatbot (Slack)          │  │
│  │  メトリクス: スループット, CPU, ストレージ容量                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### データフロー

1. ユーザーが NFS/SMB 経由で FSxN にファイルを書き込み
2. S3 Access Point がボリュームデータを S3 オブジェクトとして公開
3. Glue Crawler が S3 AP 経由でデータスキーマを検出 → Data Catalog に登録
4. Athena が Data Catalog をクエリ → S3 AP 経由でデータ読み取り → 結果を S3 バケットに出力

## 前提条件

- AWS CLI v2 がインストールされていること
- Node.js >= 20.x、npm >= 8.1.0
- AWS CDK CLI (`npm install -g aws-cdk`)
- デプロイ先 AWS アカウントで CDK Bootstrap が実行済みであること
- BLEA ガバナンスベース（standalone または Control Tower）がデプロイ済みであること

## パラメータ設定

`parameter.ts` を編集し、環境に合わせた値を設定してください。

| パラメータ | 説明 | 開発用デフォルト | 本番推奨 |
|-----------|------|----------------|---------|
| `envName` | 環境名（タグに使用） | Development | Production |
| `vpcCidr` | VPC CIDR ブロック | 10.0.0.0/16 | 10.0.0.0/16 |
| `fsxnStorageCapacityGiB` | FSxN ストレージ容量 (GiB) | 1024 | 2048+ |
| `fsxnThroughputCapacityMBps` | FSxN スループット (MBps) | 128 | 512+ |
| `fsxnDeploymentType` | デプロイタイプ | SINGLE_AZ_1 | MULTI_AZ_1 |
| `s3AccessPointName` | S3 AP 名 (3-50文字、小文字英数+ハイフン) | fsxn-analytics-dev | fsxn-analytics-prod |
| `s3ApFileSystemIdentityUser` | S3 AP アクセス時の UNIX ユーザー | nobody | analytics-svc |
| `monitoringNotifyEmail` | アラーム通知先メール | - | 運用チームのメール |
| `monitoringSlackWorkspaceId` | Slack ワークスペース ID | - | Chatbot 設定済み ID |
| `monitoringSlackChannelId` | Slack チャネル ID | - | 運用通知チャネル |

### ファイルシステムアイデンティティについて

`s3ApFileSystemIdentityUser` は、Athena/Glue が S3 AP 経由でファイルにアクセスする際に使用される UNIX ユーザーです。

- **開発環境**: `nobody` (uid=65534) — 全ファイルへの読み取りアクセス
- **本番環境**: 専用サービスアカウント（例: `analytics-svc`）を FSxN SVM のネームサービスに登録し、適切なファイルパーミッションを設定してください

## デプロイ手順

### 1. 依存パッケージのインストール

```bash
npm ci
```

### 2. CDK Bootstrap（初回のみ）

```bash
npx cdk bootstrap --profile <your-profile>
```

### 3. パラメータ設定

`parameter.ts` を編集し、環境に合わせた値を設定します。

### 4. デプロイ

```bash
npx cdk deploy --all --profile <your-profile>
```

### 5. Glue Crawler の実行

デプロイ後、FSxN ボリュームにデータを配置した後に Glue Crawler を手動実行します：

```bash
aws glue start-crawler --name fsxn-data-crawler --profile <your-profile>
```

### 6. Athena でのクエリ実行

AWS マネジメントコンソールで Athena を開き、ワークグループ `fsxn-analytics` を選択してクエリを実行します。

## クリーンアップ

```bash
npx cdk destroy --all --profile <your-profile>
```

> ⚠️ FSxN ファイルシステム、ボリューム、KMS キーは `RemovalPolicy.RETAIN` が設定されているため、`cdk destroy` 後も残存します。手動で削除する場合は AWS コンソールまたは CLI から操作してください。

## コスト見積もり

| 構成 | 月額概算 (USD) | 内訳 |
|------|---------------|------|
| 開発 (SINGLE_AZ, 128MBps, 1TiB) | ~$500 | FSxN SSD $200 + スループット $180 + 容量プール $15 + VPC Endpoint $50 + Glue/Athena 従量 |
| 本番 (MULTI_AZ, 512MBps, 2TiB) | ~$1,500 | FSxN SSD $400 + スループット $720 + 容量プール $30 + VPC Endpoint $50 + Glue/Athena 従量 |

> ※ 上記は東京リージョン (ap-northeast-1) の概算であり、実際のコストはデータ量、クエリ頻度、FabricPool 階層化率により変動します。最新の料金は [FSx for ONTAP 料金](https://aws.amazon.com/fsx/netapp-ontap/pricing/) を参照してください。

## 共有スループットに関する注意事項

FSx for ONTAP のスループットは、全プロトコル（NFS, SMB, S3 Access Point）で共有されます。

- Glue Crawler 実行中は S3 AP 経由の読み取りが発生し、NFS/SMB クライアントのスループットに影響する可能性があります
- デフォルトの Crawler スケジュール (`cron(0 2 * * ? *)`) は夜間 2:00 AM に設定されています
- 本番環境では、NFS クライアントのピーク使用量 + 分析ワークロードを考慮してスループットをサイジングしてください

## S3 Access Point の制約事項

S3 Access Point for FSx for ONTAP には以下の制約があります：

| 機能 | サポート状況 |
|------|-------------|
| GetObject, PutObject, ListObjectsV2, DeleteObject | ✅ サポート |
| Multipart Upload | ✅ サポート |
| Athena, Glue, Bedrock KB, SageMaker | ✅ サポート (Internet-origin AP) |
| Lambda (VPC 内) | ✅ サポート (VPC-origin AP) |
| S3 Event Notifications | ❌ 非サポート |
| S3 Select | ❌ 非サポート |
| 条件付き書き込み (Conditional Writes) | ❌ 非サポート |
| Apache Iceberg / Delta Lake / Hudi (テーブル書き込み) | ❌ 非サポート (atomic rename 不可) |

## セキュリティ

- VPC はインターネット接続なし（IGW/NAT なし）
- 全データは KMS CMK で暗号化（自動キーローテーション有効）
- FSxN セキュリティグループは VPC 内部トラフィックのみ許可
- IAM ロールは最小権限の原則に基づき、特定リソースにスコープ
- S3 結果バケットはパブリックアクセス完全ブロック + バージョニング有効

## 関連リンク

- [FSx for ONTAP S3 Access Points (2025年12月 GA)](https://aws.amazon.com/about-aws/whats-new/2025/12/amazon-fsx-netapp-ontap-s3-access/)
- [AWS::FSx::S3AccessPointAttachment (CloudFormation)](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-fsx-s3accesspointattachment.html)
- [S3 AP と AWS サービスの連携](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/using-access-points-with-aws-services.html)
- [Baseline Environment on AWS (BLEA)](https://github.com/aws-samples/baseline-environment-on-aws)


## クイックデモ（15分）

パートナーや顧客にデモする場合の最短手順：

1. `parameter.ts` で `env` を設定 → `npx cdk deploy --all` (35分待機)
2. `scripts/generate-test-data.py /tmp/testdata` → EC2 or DataSync でFSxN に投入
3. `aws glue start-crawler --name fsxn-data-crawler` → Athena Console でクエリ実行

**ワンライナー要約**: 「ファイルサーバーに CSV を置くだけで SQL 分析可能に。コピーもETLも不要。」

## データ投入パターン

本番環境では以下のパターンでデータを FSxN に配置できます：

| パターン | 方法 | ユースケース |
|---------|------|------------|
| **NFS マウント** | EC2/ECS から直接書き込み | アプリケーションからの直接出力 |
| **AWS DataSync** | オンプレミス NAS → FSxN | 既存ファイルサーバーからのマイグレーション |
| **AWS Transfer Family** | SFTP/FTPS でアップロード | パートナーからのファイル受信 |
| **SnapMirror** | オンプレ ONTAP → FSxN | 既存 NetApp 環境からのレプリケーション |
| **S3 AP PutObject** | Lambda/アプリから S3 API 書き込み | サーバーレスワークロード |

## 次のステップ（PoC → 本番化ジャーニー）

Spec A のデプロイ後、以下のパスで本番化を進められます：

1. **BI 可視化**: Amazon QuickSight → Athena データソース → ダッシュボード作成
2. **生成 AI 連携**: Amazon Bedrock Knowledge Base → S3 AP をデータソースに設定 → RAG チャット
3. **ML 学習**: Amazon SageMaker → S3 AP 経由でトレーニングデータ取得
4. **本番化**: devParameter → prodParameter (Multi-AZ, 高スループット) に切り替え
5. **セキュリティ強化**: Spec B (Cyber Resilience) の TPS + ARP/AI を追加

## データ分類ガイダンス

本テンプレートを利用する際のデータ分類の目安：

| 分類レベル | 利用可否 | 備考 |
|-----------|---------|------|
| 公開情報 | ✅ | 制約なし |
| 社内限定（機密性1） | ✅ | KMS 暗号化 + VPC 閉域で保護 |
| 機密（機密性2） | ✅ | IAM + Lake Formation でアクセス制御。S3 AP の2層認可モデルで保護 |
| 極秘（機密性3） | ⚠️ 要追加検討 | SnapLock + TPS (Spec B) の追加を推奨 |
| 個人情報（マイナンバー等） | ⚠️ 要法的確認 | 技術的には保護可能だが、法的・規制面の確認が別途必要 |

> ⚠️ 規制対象データの取り扱いについては、自組織の法務・コンプライアンス部門に確認してください。本テンプレートは技術的な保護措置を提供しますが、法的判断を代替するものではありません。

## 対応ファイル形式

Glue Crawler は S3 AP 経由で以下のファイル形式を自動検出できます：

| 形式 | 自動検出 | Athena クエリ | 備考 |
|------|---------|-------------|------|
| CSV | ✅ | ✅ | デフォルト対応 |
| JSON / JSON Lines | ✅ | ✅ | ネスト構造は STRUCT 型 |
| Parquet | ✅ | ✅ | カラムナ形式で高効率 |
| ORC | ✅ | ✅ | Hive 互換 |
| Avro | ✅ | ✅ | スキーマ埋め込み |
| TSV | ✅ | ✅ | Classifier 設定推奨 |
| XML | △ | △ | Custom Classifier 必要 |

> **パフォーマンス推奨**: TB級データの場合は Parquet + パーティション構造（例: `/data/year=2025/month=01/`）を推奨。S3 AP は Parquet の Range GET に対応しており、カラム pruning が有効です。
