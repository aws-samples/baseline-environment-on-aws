# PR Draft: aws-samples/baseline-environment-on-aws

> Branch: feat/fsxn-flexcache-usecase
> Base: main

---

## Title

`feat: Add FSxN FlexCache distributed access use case`

## Body

### Summary

Adds a new guest system use case demonstrating distributed file access acceleration using FSx for NetApp ONTAP FlexCache, targeting multi-site organizations (headquarters + branch offices).

### Changes

- Add `usecases/blea-guest-fsxn-flexcache-sample/` with single CDK stack:
  - Dual-FSxN architecture (Origin Multi-AZ + Cache configurable)
  - VPC Peering with inter-cluster port routing (11104/11105)
  - FlexCache Custom Resource (Lambda + ONTAP REST API)
  - Custom metrics Lambda (5-min polling for cache hit ratio, capacity, latency)
  - 3 CloudWatch Alarms + SNS
  - Optional S3 Access Point on origin volume
- 13 Jest tests
- Bilingual documentation with TTL, write-back, and data sovereignty notes

### Architecture

```
Origin VPC (10.0.0.0/16)     Cache VPC (10.1.0.0/16)
  FSxN Multi-AZ       ←VPC Peering→      FSxN (configurable)
  └── svm-origin                          └── svm-cache
      └── vol_source                          └── FlexCache
           (authoritative)                      (read cache)
```

### Review Checklist

- [x] TypeScript strict mode
- [x] Follows BLEA existing patterns (parameter.ts, constructs, monitoring)
- [x] Custom metrics for FlexCache-specific KPIs
- [x] No real account IDs, secrets, or personal information
- [x] Tests pass (`npm test`)
- [x] CDK synth succeeds
- [x] Security: inter-cluster ports scoped to peer VPC CIDR only
- [x] No Internet Gateway or NAT Gateway

### Testing

```bash
cd usecases/blea-guest-fsxn-flexcache-sample
npm ci
npm test          # 13 tests pass
npx cdk synth     # Stack synthesizes (45+ resources)
```

### Dependencies

- aws-cdk-lib ^2.236.0
- ONTAP 9.15.1+ for write-back mode (documented, disabled by default)

### Blocked Features

- Cross-region FlexCache (requires Transit Gateway — documented in README)
- Write-back mode (requires ONTAP 9.15.1+ and carries data-loss risk on cache failure)
