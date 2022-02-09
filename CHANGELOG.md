# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.3.0](https://github.com/aws-samples/baseline-environment-on-aws/compare/v1.2.1...v1.3.0) (2022-02-01)

## [1.2.0] - 2021-10-26

### BREAKING CHANGES

- Re-organize applications into usecases directory. Now we use npm workspaces to build.

### Added

- **guest-apiapp-sample** add Serverless API application sample (NodeJS and Python)
- **guest-webapp-sample** add SSL(R53+CF+ACM+ALB) implementation sample
- **guest-webapp-sample** add Canary(CloudWatch Synthetics) sample
- **guest-webapp-sample** add CloudWatch Dashboard sample
- add documents (HowTo and deployment to controltower)

### Changed

- Update CDK version to 1.129.0 and its dependencies.
- **guest-webapp-sample** generalize ECS sample. now we don't use aws-ecs-patterns.
- **guest-webapp-sample** re-organize KMS keys
- **base-ct-guest** **base-standalone** refine notification settings for SecurityHub

## [1.1.1] - 2021-06-07

### Changed

- Update CDK version to 1.107.0 and its dependencies.

## [1.1.0] - 2021-05-10

### Added

- Add Japanese documentation

## [1.0.0] - 2021-04-26

### Added

- All files, initial version
