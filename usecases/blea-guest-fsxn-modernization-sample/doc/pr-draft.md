# PR Draft: aws-samples/baseline-environment-on-aws

> Branch: feat/fsxn-modernization-usecase
> Base: main

---

## Title

`feat: Add FSxN modernization platform with modular compute patterns`

## Body

### Summary

Adds a new guest system use case demonstrating FSx for NetApp ONTAP as a shared storage foundation for workload modernization with 5 selectable compute patterns (EC2, ECS, EKS, Lambda, Batch).

### Changes

- Add `usecases/blea-guest-fsxn-modernization-sample/` with single CDK stack:
  - FSxN shared storage (NFS + S3 Access Point dual-access)
  - 5 compute patterns with parameter.ts toggles
  - CapacityManager (auto-expand with max guard)
  - AWS Backup integration
  - 3 CloudWatch Alarms + SNS
  - Conditional VPC Endpoints per enabled pattern
- 11 Jest tests (toggle ON/OFF behavior verified)
- Bilingual documentation with per-pattern guide + EKS Trident setup

### Compute Pattern Matrix

| Pattern | Access Method | VPC Endpoints Needed | Toggle |
|---------|--------------|---------------------|--------|
| EC2 ASG | NFS mount (NFSv4.1) | SSM, SSM Messages | `enableEc2Pattern` |
| Lambda | S3 AP (VPC-origin) | — | `enableLambdaPattern` |
| ECS Fargate | S3 AP (VPC-origin) | ECR, ECR Docker | `enableEcsPattern` |
| EKS | Trident CSI | — (manual setup) | `enableEksPattern` |
| Batch | NFS host mount | — | `enableBatchPattern` |

### Review Checklist

- [x] TypeScript strict mode
- [x] Follows BLEA patterns (parameter.ts toggles, construct composition)
- [x] Conditional resource creation (no unused resources when pattern disabled)
- [x] No real account IDs, secrets, or personal information
- [x] Tests pass (`npm test`)
- [x] CDK synth succeeds (61 resources with EC2+Lambda+ECS+Batch)
- [x] Deployment verified (61 resources CREATE_COMPLETE)
- [x] ECS Fargate: S3 AP documented (NFS not possible on Fargate)
- [x] Security: Isolated VPC, KMS encryption, scoped IAM

### Testing

```bash
cd usecases/blea-guest-fsxn-modernization-sample
npm ci
npm test          # 11 tests pass
npx cdk synth     # Stack synthesizes
```

### Dependencies

- aws-cdk-lib ^2.236.0
- NetApp Trident CSI (manual post-deploy for EKS pattern)

### Design Notes

- **ECS desiredCount: 0** by default — Public ECR images cannot be pulled in isolated subnets. Users must push to Private ECR and set desiredCount after deployment.
- **EKS**: Uses CfnCluster (L1) to avoid kubectlLayer Lambda layer dependency. Trident setup documented in README.
- **CapacityManager**: Auto-expands storage in 1TiB increments, capped at `maxCapacityGiB` parameter.
