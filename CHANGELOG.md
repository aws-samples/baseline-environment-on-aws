# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.1.0](https://github.com/aws-samples/baseline-environment-on-aws/compare/v3.0.0...v3.1.0) (2025-10-07)


### Features

* dealing with issue [#1139](https://github.com/aws-samples/baseline-environment-on-aws/issues/1139);  add Critical to GuardDutyFindings alert ([#1140](https://github.com/aws-samples/baseline-environment-on-aws/issues/1140)) ([0c2e83c](https://github.com/aws-samples/baseline-environment-on-aws/commit/0c2e83ca53f4a11273f327e6bb7462b87cca2be5))
* **ecs-app:** use stable synthetics module ([#503](https://github.com/aws-samples/baseline-environment-on-aws/issues/503)) ([448ac6b](https://github.com/aws-samples/baseline-environment-on-aws/commit/448ac6bccaba8dd2ea8961849f8e2daf71283794))
* migrate from depcheck to knip ([#924](https://github.com/aws-samples/baseline-environment-on-aws/issues/924)) ([4246e6a](https://github.com/aws-samples/baseline-environment-on-aws/commit/4246e6aa83f367908ff4c6fecaff602d9a757ac0))
* migrate to Node.js 22 ([#1220](https://github.com/aws-samples/baseline-environment-on-aws/issues/1220)) ([777d645](https://github.com/aws-samples/baseline-environment-on-aws/commit/777d645948967fe99f76593d4124cc3b76d89b74))
* Modify env parameter ([#333](https://github.com/aws-samples/baseline-environment-on-aws/issues/333)) ([b301434](https://github.com/aws-samples/baseline-environment-on-aws/commit/b30143409ebef50b7917ec97d31567fb6cb60862))
* Use Node.js 18 as default build environment ([#439](https://github.com/aws-samples/baseline-environment-on-aws/issues/439)) ([8d87cf5](https://github.com/aws-samples/baseline-environment-on-aws/commit/8d87cf57ea3a76f8bd69d1594a310ade768ba474))


### Bug Fixes

* add ObjectOwnership property ([#364](https://github.com/aws-samples/baseline-environment-on-aws/issues/364)) ([099e143](https://github.com/aws-samples/baseline-environment-on-aws/commit/099e143a4d56fe7a56c2cc6d313ccf0381ff3755)), closes [#363](https://github.com/aws-samples/baseline-environment-on-aws/issues/363)
* **blea-guest-serverless-api-sample:** lambda runtime version and snapshot update ([#784](https://github.com/aws-samples/baseline-environment-on-aws/issues/784)) ([7831a9e](https://github.com/aws-samples/baseline-environment-on-aws/commit/7831a9ec1466c929f924d531b8c9ef86568a8a00))
* deprecated code, RDS's instanceProps and CloudWatch Synthetics's older runtime ([#662](https://github.com/aws-samples/baseline-environment-on-aws/issues/662)) ([73342d0](https://github.com/aws-samples/baseline-environment-on-aws/commit/73342d0da1d4b386160a4a117f9dc7d41bb32b1c)), closes [#604](https://github.com/aws-samples/baseline-environment-on-aws/issues/604) [#652](https://github.com/aws-samples/baseline-environment-on-aws/issues/652) [#604](https://github.com/aws-samples/baseline-environment-on-aws/issues/604) [#652](https://github.com/aws-samples/baseline-environment-on-aws/issues/652)
* make public variable read only outside construct ([#824](https://github.com/aws-samples/baseline-environment-on-aws/issues/824)) ([fd79f6a](https://github.com/aws-samples/baseline-environment-on-aws/commit/fd79f6add92338679f9dc95e59ad209083316c63))
* metrics name ([#438](https://github.com/aws-samples/baseline-environment-on-aws/issues/438)) ([c4b69fe](https://github.com/aws-samples/baseline-environment-on-aws/commit/c4b69fe5315050fd28be93a2857c63ae010879eb))
* pin esbuild version to 0.21.x ([#815](https://github.com/aws-samples/baseline-environment-on-aws/issues/815)) ([2e51dca](https://github.com/aws-samples/baseline-environment-on-aws/commit/2e51dcafe36d471485984ce76ae770fb5c34ef16))
* replace deprecated aws-portal:*Billing policy ([#583](https://github.com/aws-samples/baseline-environment-on-aws/issues/583)) ([d2a1300](https://github.com/aws-samples/baseline-environment-on-aws/commit/d2a1300c8b1fbfd4f502fca2d2a4b9f0733bd1d6))
* replace managedPolicies object literals with ManagedPolicy.fromAwsManagedPolicyName ([#1218](https://github.com/aws-samples/baseline-environment-on-aws/issues/1218)) ([1698332](https://github.com/aws-samples/baseline-environment-on-aws/commit/16983327b4a2686610906444a9f13e5068fd9109))
* rm eslint & prettier from ignoreDependencies in knip config ([#940](https://github.com/aws-samples/baseline-environment-on-aws/issues/940)) ([af60c49](https://github.com/aws-samples/baseline-environment-on-aws/commit/af60c494ed52865710fb3b1396665cd2e9fa27ab)), closes [#924](https://github.com/aws-samples/baseline-environment-on-aws/issues/924) [/github.com/aws-samples/baseline-environment-on-aws/pull/924#pullrequestreview-2490925750](https://github.com/aws-samples//github.com/aws-samples/baseline-environment-on-aws/pull/924/issues/pullrequestreview-2490925750)


### Document Changes

* v3 migration doc ([#372](https://github.com/aws-samples/baseline-environment-on-aws/issues/372)) ([4981bbb](https://github.com/aws-samples/baseline-environment-on-aws/commit/4981bbbc4277f21df2a06605739af4ba0dffd3c1))

## [3.0.0](https://github.com/aws-samples/baseline-environment-on-aws/compare/v2.1.0...v3.0.0) (2023-04-20)


### ⚠ BREAKING CHANGES

* BLEA v3 (#298)

### Features

* BLEA v3 ([#298](https://github.com/aws-samples/baseline-environment-on-aws/issues/298)) ([d54371b](https://github.com/aws-samples/baseline-environment-on-aws/commit/d54371b372411bbf9926b76efe0a7207f6cb1faf)), closes [#221](https://github.com/aws-samples/baseline-environment-on-aws/issues/221) [#237](https://github.com/aws-samples/baseline-environment-on-aws/issues/237) [#161](https://github.com/aws-samples/baseline-environment-on-aws/issues/161) [#220](https://github.com/aws-samples/baseline-environment-on-aws/issues/220)
* Change Aurora DB instance identifier not to conflict with each samples ([#86](https://github.com/aws-samples/baseline-environment-on-aws/issues/86)) ([0a817b4](https://github.com/aws-samples/baseline-environment-on-aws/commit/0a817b48801204e183c3547aebf6dd715de6b56c))
* enable imageScanOnPush to ECR repository. ([#105](https://github.com/aws-samples/baseline-environment-on-aws/issues/105)) ([77c840a](https://github.com/aws-samples/baseline-environment-on-aws/commit/77c840a03f56e7a4e0df6c6c8d73a8084495b31c))
* **guest-webapp-sample:** Replace LaunchConfiguration with LaunchTemplate ([#183](https://github.com/aws-samples/baseline-environment-on-aws/issues/183)) ([0102836](https://github.com/aws-samples/baseline-environment-on-aws/commit/01028367b3ec282262b37de3abd1572d19370aa5))


### Bug Fixes

* **guest-webapp-sample:** Update subnet type, PRIVATE_WITH_NAT is deprecated. ([#106](https://github.com/aws-samples/baseline-environment-on-aws/issues/106)) ([bbe4bb7](https://github.com/aws-samples/baseline-environment-on-aws/commit/bbe4bb704c36846509b8e503f113b77a3f28638c))

## [2.1.0](https://github.com/aws-samples/baseline-environment-on-aws/compare/v2.0.0...v2.1.0) (2022-09-06)


### Features

* refactor cicd sample and update to CDK Pipelines ([#50](https://github.com/aws-samples/baseline-environment-on-aws/issues/50)) ([fa0949a](https://github.com/aws-samples/baseline-environment-on-aws/commit/fa0949a760d6028bc745b725e899fe2861428084))
* Revise metrics filter for UnauthorizedAttemptsAlarm. ([#51](https://github.com/aws-samples/baseline-environment-on-aws/issues/51)) ([6dd30b4](https://github.com/aws-samples/baseline-environment-on-aws/commit/6dd30b4c41c8e512af2ab609cbfb141a88c0f801))
* upgrade synthetics runtime to 3.3 ([#29](https://github.com/aws-samples/baseline-environment-on-aws/issues/29)) ([0eb09e9](https://github.com/aws-samples/baseline-environment-on-aws/commit/0eb09e97060ca24f6583f7d313cc28768bb204a6))
* upgrade synthetics runtime to 3.5 ([#74](https://github.com/aws-samples/baseline-environment-on-aws/issues/74)) ([f9f382c](https://github.com/aws-samples/baseline-environment-on-aws/commit/f9f382cc3908d239d947d8ac7bf1728cd1727519))
* **guest-webapp-sample:** Change container repository to ECR with pull through cache. ([#72](https://github.com/aws-samples/baseline-environment-on-aws/issues/72)) ([eb33947](https://github.com/aws-samples/baseline-environment-on-aws/commit/eb339476f91f5c96419353889dbabb958a96b688))

### Bug Fixes

* **base-ct-guest:** Fix to support Control Tower LZ v3.0 ([#70](https://github.com/aws-samples/baseline-environment-on-aws/issues/70)) ([9067290](https://github.com/aws-samples/baseline-environment-on-aws/commit/9067290883a9216765eeb6fddf9ac9aa06a28fca))
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
- **gov-base-ct** **gov-base-standalone** refine notification settings for SecurityHub

## [1.1.1] - 2021-06-07

### Changed

- Update CDK version to 1.107.0 and its dependencies.

## [1.1.0] - 2021-05-10

### Added

- Add Japanese documentation

## [1.0.0] - 2021-04-26

### Added

- All files, initial version
