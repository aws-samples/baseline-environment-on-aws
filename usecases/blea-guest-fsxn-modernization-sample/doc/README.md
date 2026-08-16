# BLEA Guest System: FSxN Modernization Platform

## Overview

A pattern that uses Amazon FSx for NetApp ONTAP as a shared storage foundation when migrating from VMware/on-premises to AWS. Compute patterns (EC2/ECS/EKS/Lambda/Batch) are modularly selectable via parameter.ts.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ VPC (Private Subnets, No Internet)                       │
│                                                          │
│  FSx for NetApp ONTAP (Shared Storage)                   │
│  ├── NFS Volume (/shared)  → EC2, Batch                 │
│  └── S3 Access Point       → Lambda, ECS (Fargate)      │
│                                                          │
│  [EC2 ASG]  [ECS Fargate]  [EKS]  [Lambda]  [Batch]   │
│   NFS mount   S3 AP API   Trident  S3 AP    NFS mount  │
│                CSI PV                                    │
│                                                          │
│  ServerlessOps: CapacityManager (auto-expand)            │
│  DataProtection: AWS Backup (daily)                      │
│  Monitoring: 3 Alarms + SNS                             │
└─────────────────────────────────────────────────────────┘
```

## Compute Patterns

| Pattern | Access Method | Use Case | Toggle |
|---------|--------------|----------|--------|
| **EC2** | NFS mount (NFSv4.1) | Legacy apps, VM migration | `enableEc2Pattern` |
| **ECS Fargate** | S3 AP (VPC-origin) | Containerized batch | `enableEcsPattern` |
| **EKS** | Trident CSI (NFS PV) | Kubernetes workloads | `enableEksPattern` |
| **Lambda** | S3 AP (VPC-origin) | Serverless processing | `enableLambdaPattern` |
| **Batch** | NFS mount (EC2) | Large-scale batch, Spot | `enableBatchPattern` |

> **ECS Fargate Note**: Fargate **cannot** mount FSxN NFS directly. Data is accessed via S3 Access Point. If POSIX file operations are required, use the EC2 pattern instead.

### ECS Fargate Production Setup

By default, ECS Service is deployed with `desiredCount: 0`. To go to production:

1. Verify ECR VPC Endpoints are active (`enableEcsPattern: true` creates them automatically)
2. Push container images to Private ECR (Public ECR is not supported via VPC Endpoint)
3. Set `desiredCount` in `parameter.ts` to 1 or more
4. Run `npx cdk deploy` to update

> ⏱️ Initial deployment takes 20–35 minutes. The majority of this time is FSx for ONTAP file system provisioning.

## Cost Estimate

| Configuration | Monthly Cost (USD) |
|---------------|-------------------|
| Minimum (FSxN + EC2 + Lambda) | ~$550 |
| Full (all patterns ON) | ~$2,000 |
| VPC Endpoints (8 × 2AZ) | ~$115 |

## Expected Benefits

| Metric | Before (VMware) | After (AWS + FSxN) |
|--------|-----------------|-------------------|
| Storage management effort | Manual operations | CapacityManager auto-expand |
| Data copies | Duplicated per service | Single shared storage |
| Dev/Test environment creation | Hours | Instant via FlexClone |
| Cost efficiency | Fixed infrastructure | FabricPool + Spot |

## EKS + Trident CSI Setup

After CDK deployment, execute manually:

```bash
# 1. Install Trident
helm repo add netapp-trident https://netapp.github.io/trident-helm-chart
helm install trident netapp-trident/trident-operator -n trident --create-namespace

# 2. Backend configuration
kubectl apply -f - <<EOF
apiVersion: trident.netapp.io/v1
kind: TridentBackendConfig
metadata:
  name: fsxn-backend
  namespace: trident
spec:
  version: 1
  storageDriverName: ontap-nas
  managementLIF: <SVM-MANAGEMENT-ENDPOINT>
  dataLIF: <SVM-NFS-ENDPOINT>
  svm: svm-platform
  credentials:
    name: fsxn-secret
EOF

# 3. Create StorageClass
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fsxn-sc
provisioner: csi.trident.netapp.io
parameters:
  backendType: ontap-nas
EOF
```

## License

MIT-0
