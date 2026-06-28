# Issue Draft: aws-samples/baseline-environment-on-aws

> Target: https://github.com/aws-samples/baseline-environment-on-aws/issues
> Status: Draft (pending review)

---

## Title

`[Feature Request] Add FSx for NetApp ONTAP FlexCache distributed access use case`

## Body

### Summary

I would like to propose a new guest system use case that demonstrates distributed file access acceleration using FSx for NetApp ONTAP FlexCache, connecting a headquarters (origin) and branch offices (cache) with transparent caching.

### Business Problem

Organizations with distributed offices face poor file access performance over WAN links:
- File open latency: 100-300ms (vs <5ms local)
- WAN bandwidth saturation from duplicate transfers
- Users copying files locally (data sprawl, version conflicts)

Traditional solutions (file sync tools, DFS-R) require complex replication topologies and create data consistency issues. **FlexCache provides transparent read caching at the storage layer** — no application changes needed, automatic coherence via origin delegation.

### Motivation

BLEA currently has no pattern for:
- Multi-VPC storage architectures
- Cross-site data acceleration
- Storage-native caching (vs application-layer caching)
- Public sector / local government branch-office connectivity

This is particularly relevant for Japanese public sector (地方自治体) where headquarters and branch offices share document repositories.

### Proposed Architecture

```
[Origin VPC: Headquarters]              [Cache VPC: Branch]
├── FSxN (Multi-AZ, authoritative)      ├── FSxN (Single/Multi-AZ)
│   ├── SVM: svm-origin                 │   ├── SVM: svm-cache
│   └── Volume (NFS, source data)       │   └── FlexCache Volume (read cache)
├── Inter-cluster LIF (11104/11105)     ├── Inter-cluster LIF
└── VPC Peering (same region)           └── VPC Peering
         └──────────────────────────────────────┘
                    TCP 11104/11105

Custom Metrics Lambda → CloudWatch (CacheHitRatio, Capacity, Latency)
3 Alarms + SNS notification
```

### Key Design Decisions

- **Dual-FSxN architecture** with VPC Peering (same-region) or Transit Gateway (cross-region)
- **FlexCache Custom Resource** via Lambda for inter-cluster peering + FlexCache creation
- **Custom CloudWatch metrics** (FlexCache hit ratio, capacity, origin latency via ONTAP REST API)
- **Optional S3 Access Point** on origin volume for analytics integration
- **Write-back mode** documented but disabled by default (ONTAP 9.15.1+ required)
- **Data sovereignty notes** for public sector (cache ≠ authoritative copy)

### Implementation Status

- ✅ CDK code complete (TypeScript strict, single stack)
- ✅ 13 Jest tests passing
- ✅ CDK synth verified (45+ resources)
- ✅ Custom metrics Lambda with 5-min ONTAP API polling
- ✅ Bilingual documentation with TTL/write-back/cost analysis
- ✅ Deployment verification complete

### Important Caveats

- **TTL-based coherence**: FlexCache uses TTL (default 1h) for read consistency. Within TTL, cache may serve stale data if origin is updated. This is acceptable for document sharing but NOT for real-time collaboration.
- **CDK version ^2.236.0**: Required if S3 Access Point option is enabled (`AWS::FSx::S3AccessPointAttachment` support, released Dec 2025).

### Cost Estimate

| Configuration | Monthly (USD) |
|---------------|---------------|
| Origin (Multi-AZ, 128MBps, 1TiB) | ~$600 |
| Cache (Single-AZ, 128MBps, 1TiB) | ~$400 |
| VPC Peering + data transfer | ~$10 |
| **Total** | **~$1,010** |

### Checklist

- [x] TypeScript CDK v2 (aws-cdk-lib ^2.236.0)
- [x] Single stack, independently deployable
- [x] parameter.ts with origin/cache configuration
- [x] Custom metrics + 3 CloudWatch Alarms + SNS
- [x] Snapshot + assertion tests (13 tests)
- [x] Bilingual documentation (Japanese + English)
- [x] MIT-0 license compatible
- [x] No real account IDs or secrets in code
- [x] cdk-nag (AwsSolutions pack) compatible — can be integrated on request

### Related Resources

- [FSx for ONTAP FlexCache](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/flexcache.html)
- [ONTAP FlexCache Write-back](https://docs.netapp.com/us-en/ontap/flexcache/write-back-overview-concept.html)
- [VPC Peering with FSx for ONTAP](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/multi-vpc-access.html)

### Next Steps

If maintainers are interested, I will submit a PR with the complete implementation.
