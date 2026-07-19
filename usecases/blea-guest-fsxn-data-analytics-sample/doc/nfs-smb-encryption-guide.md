# NFS/SMB 通信暗号化ガイド

> 本ドキュメントは、セキュリティベストプラクティス「通信の暗号化」に対応するため、  
> CDK テンプレートでデプロイした FSx for NetApp ONTAP 環境に対して  
> NFS および SMB の通信暗号化を有効化する手順を示します。

---

## 概要

CDK テンプレートは以下の暗号化を自動設定します。

| レイヤー | 対応状況 | 方法 |
|---------|---------|------|
| 保存時暗号化 | ✅ CDK で自動設定 | KMS CMK (自動ローテーション有効) |
| S3 通信暗号化 | ✅ CDK で自動設定 | enforceSSL: true |
| VPC Endpoint 通信 | ✅ CDK で自動設定 | TLS (AWS 内部) |
| NFS 通信暗号化 | ⚠️ 追加設定が必要 | NFS over TLS または Kerberos |
| SMB 通信暗号化 | ⚠️ 追加設定が必要 | SMB 3.0 暗号化 |

NFS/SMB の通信暗号化は ONTAP レベルの設定であり、CloudFormation / CDK では直接制御できません。  
デプロイ後に ONTAP CLI または REST API で設定する必要があります。

---

## NFS over TLS の有効化 (ONTAP 9.15.1 以降)

### 前提条件

- ONTAP バージョン 9.15.1 以降
- TLS 証明書が SVM にインストール済み

### 手順

```bash
# 1. FSx for ONTAP 管理エンドポイントに SSH 接続
ssh fsxadmin@<management-endpoint-ip>

# 2. SVM の NFS over TLS を有効化
nfs tls interface enable -vserver svm-analytics -lif <data-lif-name> -certificate-name <cert-name>

# 3. 確認
nfs tls interface show -vserver svm-analytics
```

### クライアント側の設定

NFS クライアント (Linux) で TLS マウントを利用するには:

```bash
# stunnel または nconnect + TLS を使用
mount -t nfs -o vers=4.1,sec=sys,tls <fsxn-ip>:/data /mnt/data
```

> **注意**: NFS over TLS は NFS v4.1 以降で利用可能です。  
> 古いクライアントでは Kerberos (sec=krb5p) による暗号化を検討してください。

---

## NFS Kerberos 暗号化 (krb5p)

### 前提条件

- Active Directory または MIT Kerberos KDC
- SVM が AD ドメインに参加済み

### 手順

```bash
# 1. SVM の Kerberos 設定
vserver nfs kerberos realm create -vserver svm-analytics \
  -realm EXAMPLE.COM \
  -kdc-ip <kdc-ip> \
  -adminserver-ip <admin-ip>

# 2. データ LIF で Kerberos を有効化
vserver nfs kerberos interface enable -vserver svm-analytics \
  -lif <data-lif-name> \
  -spn nfs/<fqdn>@EXAMPLE.COM

# 3. エクスポートポリシーで krb5p を強制
vserver export-policy rule modify -vserver svm-analytics \
  -policyname default -ruleindex 1 \
  -security-flavor krb5p
```

### クライアント側のマウント

```bash
mount -t nfs4 -o sec=krb5p <fsxn-fqdn>:/data /mnt/data
```

---

## SMB 3.0 暗号化の有効化

### 前提条件

- Active Directory 統合済み
- SMB 3.0 対応クライアント (Windows 8 以降、Windows Server 2012 以降)

### 手順

```bash
# 1. SVM レベルで SMB 暗号化を有効化
vserver cifs security modify -vserver svm-analytics -is-smb-encryption-required true

# 2. 確認
vserver cifs security show -vserver svm-analytics -fields is-smb-encryption-required

# 3. (オプション) 共有レベルで暗号化を強制
vserver cifs share properties add -vserver svm-analytics \
  -share-name <share-name> -share-properties encrypt-data
```

### 確認方法

```bash
# 暗号化された接続の確認
vserver cifs session show -vserver svm-analytics -fields connection-id,is-session-signed,is-session-encrypted
```

---

## 推奨構成

| ユースケース | 推奨プロトコル | 暗号化方式 |
|-------------|--------------|-----------|
| Linux クライアント (最新) | NFS v4.1 | NFS over TLS |
| Linux クライアント (レガシー) | NFS v4.1 | Kerberos (krb5p) |
| Windows クライアント | SMB 3.0 | SMB 暗号化必須 |
| データ分析 (S3 AP 経由) | HTTPS | TLS 1.2+ (自動) |

### セキュリティに関する注意事項

1. **閉域ネットワーク内でも暗号化を適用する**: VPC 内の通信であっても、機密データを扱うシステムでは通信暗号化が求められます
2. **Kerberos を利用する場合**: AWS Managed Microsoft AD または既存の AD 基盤との連携が必要です
3. **証明書管理**: NFS over TLS の証明書は有効期限管理が必要です。自動更新の仕組みを検討してください
4. **パフォーマンス影響**: 暗号化によるオーバーヘッドは通常 5-10% 程度です。スループット設計に含めてください

---

## 自動化の検討

デプロイ後の ONTAP 設定を自動化する場合は、以下のアプローチを検討してください。

1. **CDK Custom Resource + Lambda**: ONTAP REST API を呼び出す Lambda を Custom Resource として実行
2. **AWS Systems Manager Run Command**: FSx 管理エンドポイントに対して CLI を実行
3. **Ansible / Terraform NetApp Provider**: 既存の構成管理ツールとの統合

本プロジェクトの `shared/lambda/ontap-custom-resource/` に ONTAP REST API クライアントの雛形があります。  
将来的にはこの Custom Resource を拡張して、通信暗号化設定の自動化を検討できます。

---

## 参考リンク

- [FSx for ONTAP: NFS over TLS](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/nfs-tls.html)
- [FSx for ONTAP: Kerberos authentication](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/kerberos-authentication.html)
- [FSx for ONTAP: SMB encryption](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/smb-encryption.html)
- [ONTAP 9 NFS Reference](https://docs.netapp.com/us-en/ontap/nfs-admin/index.html)
