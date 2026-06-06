# Spec H: FSxN Modernization Platform — Deployment Verification Report v2

## Deployment Summary

| Item | Value |
|------|-------|
| Stack Name | Dev-BLEAFsxnModernization |
| Account | 178625946981 |
| Region | ap-northeast-1 |
| Deployment Time | ~25 min (FSxN) + 10 min (ECS stabilization) |
| Total Resources | 61 |
| Status | ✅ CREATE_COMPLETE |
| Date | 2026-06-06 |
| Patterns Enabled | EC2, Lambda, ECS, Batch (EKS disabled) |

## Resource Verification

### FSx for NetApp ONTAP
- ✅ FileSystem (SINGLE_AZ_1, 1024 GiB, 128 MBps)
- ✅ SVM (svm-platform)
- ✅ NFS Volume (/shared, 100 GiB)
- ✅ S3 Access Point Attachment

### Compute Patterns

| Pattern | Resources | Status | Notes |
|---------|-----------|--------|-------|
| EC2 ASG | LaunchTemplate + ASG | ✅ | NFS mount via UserData |
| Lambda | Function + IAM | ✅ | S3 AP access verified (prior deploy) |
| ECS Fargate | Cluster + Service + TaskDef | ✅ | desiredCount=0 (needs ECR VPC Endpoint for image pull) |
| Batch | ComputeEnv + JobQueue + JobDef | ✅ | NFS host path mount |
| EKS | — | ⏸️ Disabled | Requires kubectlLayer or CfnCluster + manual setup |

### Operations & Protection
- ✅ ServerlessOps: CapacityManager Lambda
- ✅ DataProtection: AWS Backup Vault + Plan
- ✅ Monitoring: 3 CloudWatch Alarms + SNS Topic

### Networking
- ✅ VPC (Isolated, no IGW/NAT)
- ✅ VPC Endpoints: S3, CloudWatch Logs, SSM, SSM Messages, ECR, ECR Docker

## Lessons Learned (v2)

1. **ECS Fargate + Isolated Subnet**: public ECR images cannot be pulled without ECR VPC Endpoints
2. **ECS Service stabilization**: CloudFormation waits up to 30 min for tasks to reach RUNNING
3. **Workaround**: Set `desiredCount: 0` for initial deployment, scale up after endpoint validation

## License

MIT-0
