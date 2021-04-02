# CI/CD for ABLE

## How to setup

*** Assuming an account running cdk bootstrap using ABLE ***

- Configure AWS CLI environment.
  - ex. aws configure
- Create new repository on GitHub based on this directory
- Link ABLE repository to new repository's root directory as a sub module
```
git submodule add https://github.com/OWNERNAME/ABLE_REPOSITORYNAME.git ./ABLEbase
```
- Get a GitHub Private Token
  - Open GitHub page
  - Open `Setting` page by upper right icon
  - Open `Developer Settings`
  - View `Personal access tokens` and click `Generate new token`
  - Copy generated token string
- Register GitHub Private Token to CodeBuild of current AWS account
Replace `<TOKEN>` to copied string and execute the command
```
aws codebuild import-source-credentials --server-type GITHUB --auth-type PERSONAL_ACCESS_TOKEN --token <TOKEN> --should-overwrite
```

- Customize buildspec.yaml and cdk.json that what stack do you need to deploy

buildspec.yaml
```
  build:
    commands:
      # You should change the following comamnd to modules you need
      - cdk deploy ABLE-Iam -c environment=dev --require-approval never
      - cdk deploy ABLE-EC2App -c environment=dev --require-approval never
```

cdk.json
```
    "dev": { // environment name to specify from CDK command line
      "envName": "Development", // environment name discription
      "githubRepositoryOwner": "ownername", // GitHub repository owner name such as 'https://github.com/ownername/repositoryname.git'
      "githubRepositoryName": "repositoryname", // GitHub repository name
      "githubTargetBranch": "develop" // target branch name
    },
```

- Build and deploy CDK template to create CodeBuild project for ABLE CI/CD
```
ncu -u
npm install
npm run build
cdk deploy
```

## How to use

- After deploying CodeBuild, if target branch will be changed, new CDK will automatically start to deploy to target AWS account
  - Repository of target branch have to have buildspec.yaml in root directory
