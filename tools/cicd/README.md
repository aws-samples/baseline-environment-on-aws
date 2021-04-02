# 使い方（とりあえず日本語でメモ）

- AWSコマンドの実行環境を整える (ex. aws configure)
- このリポジトリをクローン
- ABLE 本体をサブモジュールとしてサブディレクトリにリンク
```
git submodule add https://github.com/AYAGASAKI/ABLEbase.git ABLEbase
```
- GitHubのPrivate Tokenを取得
  - GitHubのページを開く
  - 右上の自分のアイコンから、Settingsを開く
  - Developer Settings を開く
  - Personal access tokens から Generate new token をする
  - 生成されたトークンをコピーする
- AWSアカウントに、GitHub Private Tokenを登録する
```
aws codebuild import-source-credentials --server-type GITHUB --auth-type PERSONAL_ACCESS_TOKEN --token <TOKEN> --should-overwrite
```
- CDKでCodeBuildをデプロイする
```
cdk deploy
```
- buildspec.yamlをカスタマイズして、ABLEのデプロイ対象スタックを編集する
- GitHubにmainブランチにPushされるごとに、CDKのデプロイが行われる
