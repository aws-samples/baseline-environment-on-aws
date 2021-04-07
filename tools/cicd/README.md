# Deploy AWS Baseline Envirionment from GitHub with CodeBuilde

This CDK application deploys Simple CodeBuild project to deploy resouces defined in ABLE to the same AWS account.

## Prerequisities

- You have bootstrapped CDK on the account
- You have configured AWS CLI environment (credentials) to access target account as Administrator.
- You have forked ABLE repository to your GitHub account.

## 1. Generate a GitHub Private Token

1. Open GitHub page
2. Open `Setting` page by upper right icon
3. Open `Developer Settings`
4. View `Personal access tokens` and check `repo` and `admin:repo_hook`. Then click `Generate new token`
5. Copy generated token string

## 2. Register GitHub Private Token to CodeBuild

With the AWS CLI command below, you can register GitHub private token to Codebuild. Replace `your_github_token` to copied string and execute the command and `your_profile_name` to your AWS CLI profile name.

```
aws codebuild import-source-credentials --server-type GITHUB --auth-type PERSONAL_ACCESS_TOKEN --token your_github_token --should-overwrite --profile your_profile_name
```

## 3. Setup your CodeBuild project configuration

Update tools/cicd/cdk.json so CodeBuild can access your ABLE repository and specify a target branch.

```
    "dev": {
      "env": {
        "account": "012345678901",
        "region": "ap-northeast-1"
      },
      "envName": "Development",
      "githubRepositoryOwner": "ownername",
      "githubRepositoryName": "repositoryname",
      "githubTargetBranch": "develop"
    },
```

- `dev`: Environment name to specify from CDK command line. In this sample, it should be `-c environment=dev`
- env: Target account and region you want to deploy this pipeline and resources.
- envName: Environment name discription.
- githubRepositoryOwner: GitHub repository owner name. If your reopsitory URL is 'https://github.com/ownername/repositoryname.git', you can specify `ownername`.
- githubRepositoryName: GitHub repository name. `repositoryname` on the sample above.
- githubTargetBranch: Target branch (When merged to this branch, CodeBuild will triggerd).

## 4. Deploy CodeBuild project

```
cd tools/cicd/
ncu -u
npm install
npm run build
cdk bootstrap   # If you haven't bootstrap target account
cdk deploy -c environment=dev --profile your_profile_name
```

## 5. Update buildspec.yaml

You need to specify CDK deploy command on buildspec.yaml.
For example, when you want to deploy `ABLE-EC2App` stack with `dev` environment variables on cdk.json, your buildspec.yaml will be like this.

```
version: 0.2

phases:
  install:
    commands:
      - npm i -g npm
      - npm -g install typescript aws-cdk npm-check-updates
  pre_build:
    commands:
      # You should change a directory name if submodule name is different
      - rm -f ./package-lock.json
      - ncu -u
      - npm cache clean --force
      - npm install
      - npm run build
  build:
    commands:
      - cdk deploy ABLE-ECSApp -c environment=dev --require-approval never
```

> Notes: You can add another lines to deploy another stacks.
> Notes: You don't need to specify --profile because we already add sufficient role (Administrator) to CodeBuild.

## 6. Update ABLE codes, merge and deploy

Now you set up buildspec.yaml, you can add changes to ABLE codes.
When you finished updating codes, you will commit and merge updates into target branch. Don't forget to add buildspec.yaml too.

When you push the changes into GitHub, CodeBuild project will be triggerd automatically then deploy resources you defined in ABLE CDK codes.
