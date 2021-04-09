# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.5] - 2021-04-08

### Added

- Update CDK version to 1.97 (#50)
- Separate app file and update dependency #40, #48, #39
- Support ControlTower environment #42
- CDK deployment pipeline #4
- Add snapshot test #36
- Add linter #35
- Add ECR deployment pipeline on ECSApp #34
- Update README (Architecture guide and Instruction)
- Add instruction to use CloudShell #32

### Fixed

- ECSApp reported Sev.High on SecurityHub Findings CloudFront.1 #45
- Chatbot configurationName conflict on update #37

## [0.0.4] - 2021-03-09

### Added

- Alerting to Slack with AWS Chatbot (#21)
- Mechanism to pass parameters with CDK Context (#15)
- Tag to all resources supported by CloudFormation (#12)
- ECR for deployment (Sample) (#10)

### Changed

- Specify env (account and region) for all stacks (#31)

## [0.0.3] - 2021-03-02

### Added

- Align SecurityHub compliance #20
- Encrypt EBS #24
- Config Bucket to be private #25

## [0.0.2] - 2021-02-25

### Added

- Encrypt all bucket #1
- intagrated alarm #2
- Monitoring RDS #18

## [0.0.1] - 2021-02-19

### Added

- All files, initial version
