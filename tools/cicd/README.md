# Deploy Baseline Envirionment on AWS from GitHub with CodeBuild

This CDK application deploys Simple CodeBuild project to deploy resouces defined in BLEA to the same AWS account.

# Overview

## 1. Deploy to Development environment (from your local computer)

![BLEA-Deploy-Dev](/doc/images/BLEA-Deploy-Dev.png)

## 2. Setup pipeline to Production environment (from your local computer)

![BLEA-Deploy-Pipeline](/doc/images/BLEA-Deploy-Pipeline.png)

## 3. Commit BLEA and deploy to Production environment (from GitHub)

![BLEA-Deploy-Prod](/doc/images/BLEA-Deploy-Prod.png)

# Deployment

## Prerequisities

- You have bootstrapped CDK on the account
- You have configured AWS CLI environment (credentials) to access target account as Administrator.
- You have forked BLEA repository to your GitHub account.

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

Update tools/cicd/cdk.json so CodeBuild can access your BLEA repository and specify a target branch.

```
    "prod": {
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

- `prod`: Environment name to specify from CDK command line. In this sample, it should be `-c environment=prod`
- env: Target account and region you want to deploy this pipeline and resources.
- envName: Environment name discription.
- githubRepositoryOwner: GitHub repository owner name. If your reopsitory URL is 'https://github.com/ownername/repositoryname.git', you can specify `ownername`.
- githubRepositoryName: GitHub repository name. `repositoryname` on the sample above.
- githubTargetBranch: Target branch (When merged to this branch, CodeBuild will triggerd).

## 4. Deploy CodeBuild project

```
cd tools/cicd/
npm ci
npm run build
cdk bootstrap -c environment=prod --profile your_profile_name  # If you haven't bootstrapped target account
cdk deploy -c environment=prod --profile your_profile_name
```

## 5. Update buildspec.yaml

You need to specify CDK deploy command on buildspec.yaml.
For example, when you want to deploy `BLEA-GeneralLog` stack with `dev` environment variables on cdk.json(not this directory but root directory of Baseline Anvironment on AWS), your buildspec.yaml will be like this.

```
version: 0.2

phases:
  install:
    commands:
      - npm i -g npm
      - npm -g install typescript aws-cdk npm-check-updates
  pre_build:
    commands:
      - npm ci
      - npm run build
  build:
    commands:
      - cdk deploy BLEA-GeneralLog --app "npx ts-node bin/blea-guest-ecsapp-sample.ts" -c environment=dev --require-approval never
```

> Notes: You can add another commands to build stage for deploying another stacks.
> Notes: You don't need to specify --profile on commandline. Because we already add sufficient role (Administrator) to CodeBuild.

## 6. Update BLEA codes, merge and deploy

Now you set up buildspec.yaml, you can add changes to BLEA codes.
When you finished updating codes, you will commit and merge updates into target branch. Don't forget to add buildspec.yaml too.

When you push the changes into GitHub, CodeBuild project will be triggerd automatically then deploy resources you defined in BLEA CDK codes.

# Example - How to deploy container image from GitHub

## 1. Push container image to ECR on Development environment and Deploy with CDK.

![BLEA-DeployECS-Dev](/doc/images/BLEA-DeployECS-Dev.png)

## 2. Commit dockerfile and build image with GitHub Actions then push it to ECR on Prod.

![BLEA-DeployECS-Build](/doc/images/BLEA-DeployECS-Build.png)

## 3. Commit updated BLEA code to GitHub and ECS pull new container image from ECR.

![BLEA-DeployECS-Prod](/doc/images/BLEA-DeployECS-Prod.png)
