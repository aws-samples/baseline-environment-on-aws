# Issue Draft: aws-samples/baseline-environment-on-aws

> Target: https://github.com/aws-samples/baseline-environment-on-aws/issues
> Status: Draft (pending review)

---

## Title

`[Feature Request] Add FSx for NetApp ONTAP modernization platform with modular compute patterns`

## Body

### Summary

I would like to propose a new guest system use case that demonstrates Amazon FSx for NetApp ONTAP as a shared storage foundation for workload modernization, with modular compute patterns (EC2, ECS, EKS, Lambda, Batch) selectable via configuration toggles.

### Business Problem

Organizations migrating from VMware/on-premises face a common challenge: each compute platform (containers, serverless, batch) has different storage access patterns:
- EC2: NFS mount (POSIX semantics)
- ECS Fargate: No NFS support (API-based access needed)
- Lambda: No persistent mounts (API-based access needed)
- EKS: CSI drivers (Trident)
- Batch: NFS mount (EC2 launch type)

Without a unified storage pattern, organizations create data silos per compute platform. **This use case provides a single FSxN storage layer accessible by all patterns** via two access methods: NFS mount (EC2/Batch) and S3 Access Point (Lambda/ECS).

### Motivation

BLEA currently provides compute-focused samples (ECS, EC2, Serverless API) but no sample showing:
- Shared storage across multiple compute patterns
- Gradual migration path (VM → containers → serverless)
- NFS + S3 Access Point dual-access architecture
- Auto-capacity management (serverless storage ops)

### Proposed Architecture

```
[VPC — Private Isolated, No Internet]
├── FSx for NetApp ONTAP (shared storage)
│   ├── NFS Volume (/shared) → EC2 ASG, AWS Batch
│   └── S3 Access Point → Lambda, ECS Fargate
│
├── [EC2 ASG]     — NFS mount (NFSv4.1, noresvport)    enableEc2Pattern
├── [ECS Fargate] — S3 AP (VPC-origin)                  enableEcsPattern
├── [EKS]         — Trident CSI (NFS PersistentVolume)  enableEksPattern
├── [Lambda]      — S3 AP (VPC-origin)                  enableLambdaPattern
├── [Batch]       — NFS host mount + Spot               enableBatchPattern
│
├── ServerlessOps: CapacityManager (auto-expand with max guard)
├── DataProtection: AWS Backup (daily, 7/30-day retention)
└── Monitoring: 3 Alarms + SNS
```

### Key Design Decisions

- **Toggle-based patterns** (`enableXxxPattern: boolean` in parameter.ts)
- **Two access methods**: NFS mount (EC2/Batch) and S3 AP (Lambda/ECS)
- **ECS Fargate limitation**: documented that Fargate cannot mount NFS — S3 AP alternative provided
- **EKS**: CfnCluster (L1) to avoid kubectlLayer dependency; Trident setup documented
- **CapacityManager**: Auto-expand with configurable max guard (prevents runaway costs)
- **Isolated VPC**: Conditional VPC Endpoints (SSM for EC2, ECR for ECS, always CW Logs + S3)
- **desiredCount: 0** for ECS (needs Private ECR in production)
- **Single stack design**: All patterns share the same VPC and FSxN. Resource count (61 max) stays within CloudFormation limits. Split into multiple stacks would require cross-stack references for FSxN, adding complexity.
- **CDK version ^2.236.0**: Required for `AWS::FSx::S3AccessPointAttachment` ONTAP support

### Implementation Status

- ✅ CDK code complete (TypeScript strict, single stack, 5 compute patterns)
- ✅ 11 Jest tests passing (toggle ON/OFF behavior verified)
- ✅ Deployed and verified (61 resources, EC2+Lambda+ECS+Batch confirmed)
- ✅ Bilingual documentation with per-pattern guide
- ✅ EKS Trident setup instructions included

### Cost Estimate

| Configuration | Monthly (USD) |
|---------------|---------------|
| Minimum (FSxN + EC2 + Lambda) | ~$550 |
| Full (all patterns ON) | ~$2,000 |
| VPC Endpoints (varies by pattern) | ~$115 |

### Checklist

- [x] TypeScript CDK v2 (aws-cdk-lib ^2.236.0)
- [x] Single stack, independently deployable
- [x] parameter.ts with per-pattern toggles
- [x] Monitoring with CloudWatch + SNS (Chatbot optional)
- [x] Snapshot + assertion tests (11 tests)
- [x] Bilingual documentation (Japanese + English)
- [x] MIT-0 license compatible
- [x] No real account IDs or secrets in code
- [x] Deployment verified in real AWS account
- [x] cdk-nag (AwsSolutions pack) compatible — can be integrated on request

### Related Resources

- [FSx for ONTAP S3 Access Points](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/s3-access-points.html)
- [NetApp Trident CSI for EKS](https://docs.netapp.com/us-en/trident/trident-use/worker-node-prep.html)
- [AWS Batch with ECS](https://docs.aws.amazon.com/batch/latest/userguide/getting-started-ec2.html)

### Next Steps

If maintainers are interested, I will submit a PR with the complete implementation.
