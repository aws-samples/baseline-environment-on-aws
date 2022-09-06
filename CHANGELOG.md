# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.1.0](https://github.com/aws-samples/baseline-environment-on-aws/compare/v1.3.0...v2.1.0) (2022-09-06)


### ⚠ BREAKING CHANGES

* Update to CDKv2 (#23)

### Features

* refactor cicd sample and update to CDK Pipelines ([#50](https://github.com/aws-samples/baseline-environment-on-aws/issues/50)) ([fa0949a](https://github.com/aws-samples/baseline-environment-on-aws/commit/fa0949a760d6028bc745b725e899fe2861428084))
* Revise metrics filter for UnauthorizedAttemptsAlarm. ([#51](https://github.com/aws-samples/baseline-environment-on-aws/issues/51)) ([6dd30b4](https://github.com/aws-samples/baseline-environment-on-aws/commit/6dd30b4c41c8e512af2ab609cbfb141a88c0f801))
* Update to CDKv2 ([#23](https://github.com/aws-samples/baseline-environment-on-aws/issues/23)) ([74fe43c](https://github.com/aws-samples/baseline-environment-on-aws/commit/74fe43c84d37c57438c23e56cf9ba89233cc6179))
* upgrade synthetics runtime to 3.3 ([#29](https://github.com/aws-samples/baseline-environment-on-aws/issues/29)) ([0eb09e9](https://github.com/aws-samples/baseline-environment-on-aws/commit/0eb09e97060ca24f6583f7d313cc28768bb204a6))
* upgrade synthetics runtime to 3.5 ([#74](https://github.com/aws-samples/baseline-environment-on-aws/issues/74)) ([f9f382c](https://github.com/aws-samples/baseline-environment-on-aws/commit/f9f382cc3908d239d947d8ac7bf1728cd1727519))


### Bug Fixes

* **base-ct-guest:** Fix to support ControlTower LZ v3.0 ([#70](https://github.com/aws-samples/baseline-environment-on-aws/issues/70)) ([9067290](https://github.com/aws-samples/baseline-environment-on-aws/commit/9067290883a9216765eeb6fddf9ac9aa06a28fca))
* **base-standalone:** Replace deprecated IAM Policy `AWSConfigRole` with `AWS_ConfigRole` ([#46](https://github.com/aws-samples/baseline-environment-on-aws/issues/46)) ([47cadcc](https://github.com/aws-samples/baseline-environment-on-aws/commit/47cadcce43b8173b9cd1b346010a7263469fe313))
* enable bucket-enforce-ssl on all buckets ([#47](https://github.com/aws-samples/baseline-environment-on-aws/issues/47)) ([dac02d5](https://github.com/aws-samples/baseline-environment-on-aws/commit/dac02d5179acdf39add6ced45fa27b9b373521a8))
* vulnerabilities in minimist ([#42](https://github.com/aws-samples/baseline-environment-on-aws/issues/42)) ([2fcef62](https://github.com/aws-samples/baseline-environment-on-aws/commit/2fcef62706443dc202de2a095bced9346484692c))


### Refactoring

* **guest-webapp-sample:** Replace deprecated subnet type PRIVATE, ISOLATED ([#52](https://github.com/aws-samples/baseline-environment-on-aws/issues/52)) ([fb55afc](https://github.com/aws-samples/baseline-environment-on-aws/commit/fb55afc95e1c5bf63252c184cddcd8fb6c936105))


### Document Changes

* Add a guidance to suppress alerts about CodeBuild from Security Hub  ([#48](https://github.com/aws-samples/baseline-environment-on-aws/issues/48)) ([66358ec](https://github.com/aws-samples/baseline-environment-on-aws/commit/66358ec92650109339d3716e73b6c7d4cd0071a2))
* Add how to enable Inspector(v2) manually ([#56](https://github.com/aws-samples/baseline-environment-on-aws/issues/56)) ([eb32879](https://github.com/aws-samples/baseline-environment-on-aws/commit/eb3287990ed09ea5b102d2deee1d09575a51c913))
* Fix image path for opening CloudShell ([#57](https://github.com/aws-samples/baseline-environment-on-aws/issues/57)) ([1df2898](https://github.com/aws-samples/baseline-environment-on-aws/commit/1df2898abc9769d926617ae548f1d5af27979097))
* Fix image path(en and ja) ([#59](https://github.com/aws-samples/baseline-environment-on-aws/issues/59)) ([286ba6b](https://github.com/aws-samples/baseline-environment-on-aws/commit/286ba6bc31c8a0bfa19fe6874aefc1e3f5c634e5))
* fix link in documents ([#58](https://github.com/aws-samples/baseline-environment-on-aws/issues/58)) ([44f9d26](https://github.com/aws-samples/baseline-environment-on-aws/commit/44f9d26a669bc431881b7c88d18c0edf628aa122))
* fix NIST quick start link in code comments ([#24](https://github.com/aws-samples/baseline-environment-on-aws/issues/24)) ([5e9c5af](https://github.com/aws-samples/baseline-environment-on-aws/commit/5e9c5af712afe265e4117dd0cf4ccf27acac8abe))
* fix typo ([#53](https://github.com/aws-samples/baseline-environment-on-aws/issues/53)) ([323662f](https://github.com/aws-samples/baseline-environment-on-aws/commit/323662f430dc281a9aead5cb26d3d4efb40ce7f9))

## [2.0.0](https://github.com/aws-samples/baseline-environment-on-aws/compare/v1.3.0...v2.0.0) (2022-02-01)


### ⚠ BREAKING CHANGES

* Update to CDKv2 (#23)

### Features

* Update to CDKv2 ([#23](https://github.com/aws-samples/baseline-environment-on-aws/issues/23)) ([74fe43c](https://github.com/aws-samples/baseline-environment-on-aws/commit/74fe43c84d37c57438c23e56cf9ba89233cc6179))

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
