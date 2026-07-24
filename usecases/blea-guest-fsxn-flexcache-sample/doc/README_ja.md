# BLEA ゲストシステム: FSxN FlexCache 分散拠点アクセス高速化

## 概要

本庁（オリジン）と支所（キャッシュ）間でファイルアクセスを高速化する FSx for NetApp ONTAP FlexCache パターンです。WAN レイテンシを解消し、分散拠点のユーザーにローカル SSD 性能でのファイルアクセスを提供します。

## アーキテクチャ

```
[本庁: Origin Region]                    [支所: Cache Region/AZ]
┌─────────────────────┐  VPC Peering  ┌─────────────────────┐
│ Origin VPC           │◄────────────►│ Cache VPC            │
│  FSxN (Multi-AZ)     │  TCP 11104   │  FSxN (Single-AZ)   │
│  ├── SVM: svm-origin │  TCP 11105   │  ├── SVM: svm-cache  │
│  └── Volume (NFS)    │  (intercluster)│  └── FlexCache Vol  │
│      ↕ NFS/SMB       │              │      ↕ NFS/SMB       │
│  本庁ユーザー         │              │  支所ユーザー         │
└─────────────────────┘              └─────────────────────┘
```

## 動作原理

| アクセスパターン | 動作 | レイテンシ |
|-------------|------|----------|
| Read (キャッシュヒット) | FlexCache ローカル SSD から応答 | < 1ms |
| Read (キャッシュミス) | Origin から取得 → ローカルにキャッシュ | WAN RTT + 読み取り |
| Write (write-back OFF) | Origin に直接書き込み | WAN RTT |
| Write (write-back ON) | ローカルに書き込み → 非同期で Origin 更新 | < 1ms |

## FlexCache の重要な特性

### TTL (Time-to-Live)
- デフォルト: **1 時間**（データの読み取り TTL）
- TTL 内は Origin が更新されてもキャッシュ側は古いデータを返す
- ユースケースに応じた許容レベル:
  - ファイルサーバー（ドキュメント共有）: 1 時間 OK
  - リアルタイム共同編集: TTL 短縮が必要（要 ONTAP CLI 設定）

### Write-back モード (ONTAP 9.15.1+ / 2025年5月 GA)
- ローカルに書き込み → 非同期で Origin に反映
- **リスク**: キャッシュ側 AZ 障害時にコミット済み未同期データが失われる可能性
- **推奨**: クリティカルな書き込みは Origin に直接実行

### データ主権の注意
- FlexCache のデータは Origin の「複製」であり、正データは常に Origin 側
- キャッシュ側のデータを「正」として法的に扱えない場合がある
- 公共セクターでは、どちらが authoritative かを運用ポリシーで明確化すること

## 前提条件

1. AWS CDK CLI + Node.js >= 20.x
2. FSxN 管理パスワードを Secrets Manager に事前登録
3. 同一リージョン内 FlexCache: VPC Peering で可能
4. **クロスリージョン FlexCache: Transit Gateway 必須**（VPC Peering は非対応）

## デプロイ

```bash
npm ci
npx cdk deploy --all --profile <your-profile>
```

> ⏱️ 初回デプロイには 30〜50 分程度かかります。2つの FSx for ONTAP ファイルシステム（Origin + Cache）が順次プロビジョニングされた後、FlexCache リレーションシップが作成されます。

## コスト見積もり

| 構成 | 月額 (USD) | 内訳 |
|------|-----------|------|
| Origin (Multi-AZ, 128MBps, 1TiB) | ~$600 | SSD + throughput |
| Cache (Single-AZ, 128MBps, 1TiB) | ~$400 | SSD + throughput |
| VPC Peering (同一リージョン) | ~$10 | データ転送 $0.01/GB |
| Monitoring (Metrics Lambda) | ~$1 | 5分間隔ポーリング |
| **合計** | **~$1,010** | |

### クロスリージョン追加コスト

| データ転送 | 月額 |
|-----------|------|
| Cache miss 100GB/日 × 30日 | ~$270 (ap-northeast-1↔3) |
| Transit Gateway (2 attach) | ~$73 |

## 期待される効果

| 指標 | Before | After |
|------|--------|-------|
| ファイルオープン遅延 (支所) | 100-300ms | < 5ms (hit時) |
| WAN 帯域使用量 | 100% | 10-40% (hit率依存) |
| 支所ユーザー体験 | 遅い | ローカル同等 |

## ライセンス

MIT-0
