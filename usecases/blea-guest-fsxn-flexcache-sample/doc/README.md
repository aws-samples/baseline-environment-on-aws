# BLEA Guest System: FSxN FlexCache Distributed Access Acceleration

## Overview

A FlexCache pattern using FSx for NetApp ONTAP to accelerate file access between a headquarters (origin) and branch offices (cache). Eliminates WAN latency by providing local SSD performance to distributed users.

## Architecture

```
[Headquarters: Origin Region]           [Branch: Cache Region/AZ]
┌─────────────────────┐  VPC Peering  ┌─────────────────────┐
│ Origin VPC           │◄────────────►│ Cache VPC            │
│  FSxN (Multi-AZ)     │  TCP 11104   │  FSxN (Single-AZ)   │
│  ├── SVM: svm-origin │  TCP 11105   │  ├── SVM: svm-cache  │
│  └── Volume (NFS)    │ (intercluster)│  └── FlexCache Vol  │
│      ↕ NFS/SMB       │              │      ↕ NFS/SMB       │
│  HQ Users            │              │  Branch Users         │
└─────────────────────┘              └─────────────────────┘
```

## How It Works

| Access Pattern | Behavior | Latency |
|----------------|----------|---------|
| Read (cache hit) | Served from FlexCache local SSD | < 1ms |
| Read (cache miss) | Fetched from origin → cached locally | WAN RTT + read |
| Write (write-back OFF) | Written directly to origin | WAN RTT |
| Write (write-back ON) | Written locally → async sync to origin | < 1ms |

## Key FlexCache Characteristics

### TTL (Time-to-Live)
- Default: **1 hour** (data read TTL)
- Within TTL, cache returns stale data even if origin is updated
- Acceptable levels vary by use case:
  - File server (document sharing): 1 hour OK
  - Real-time collaborative editing: requires shortened TTL (ONTAP CLI config)

### Write-back Mode (ONTAP 9.15.1+ / May 2025 GA)
- Write locally → async propagation to origin
- **Risk**: Committed but unsynced data may be lost on cache-side AZ failure
- **Recommendation**: Critical writes should go directly to origin

### Data Sovereignty Considerations
- FlexCache data is a "replica" of origin; authoritative data is always at origin
- Cached data may not be legally treated as "original" in some jurisdictions
- Public sector deployments must clarify which side is authoritative in operational policy

## Prerequisites

1. AWS CDK CLI + Node.js >= 20.x
2. FSxN admin password stored in Secrets Manager
3. Same-region FlexCache: VPC Peering supported
4. **Cross-region FlexCache: Transit Gateway required** (VPC Peering not supported)

## Cost Estimate

| Component | Monthly Cost (USD) | Details |
|-----------|-------------------|---------|
| Origin (Multi-AZ, 128MBps, 1TiB) | ~$600 | SSD + throughput |
| Cache (Single-AZ, 128MBps, 1TiB) | ~$400 | SSD + throughput |
| VPC Peering (same region) | ~$10 | Data transfer $0.01/GB |
| Monitoring (Metrics Lambda) | ~$1 | 5-min polling interval |
| **Total** | **~$1,010** | |

### Cross-Region Additional Cost

| Data Transfer | Monthly Cost |
|---------------|-------------|
| Cache miss 100GB/day × 30 days | ~$270 (ap-northeast-1↔3) |
| Transit Gateway (2 attachments) | ~$73 |

## Expected Benefits

| Metric | Before | After |
|--------|--------|-------|
| File open latency (branch) | 100-300ms | < 5ms (on hit) |
| WAN bandwidth usage | 100% | 10-40% (hit-rate dependent) |
| Branch user experience | Slow | Local-equivalent |

## License

MIT-0
