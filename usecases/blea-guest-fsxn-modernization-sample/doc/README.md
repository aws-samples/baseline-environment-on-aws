# BLEA Guest System: FSxN Modernization Platform

## Overview

A pattern that uses Amazon FSx for NetApp ONTAP as a shared storage foundation when migrating from VMware/on-premises to AWS. Compute patterns (EC2/ECS/EKS/Lambda/Batch) are modularly selectable via parameter.ts.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ VPC (isolated subnets, no Internet Gateway / NAT)                     │
│                                                                       │
│  ┌─── Always deployed ────────────────────────────────────────────┐  │
│  │  FSx for NetApp ONTAP (shared storage)                          │  │
│  │  ├── NFS Volume (/shared) ──────── mounted by EC2, Batch        │  │
│  │  └── S3 Access Point ───────────── called by Lambda, ECS         │  │
│  │                                                                  │  │
│  │  CapacityManager (auto-expand)  ·  AWS Backup (daily)            │  │
│  │  3 CloudWatch Alarms + SNS      ·  KMS CMK                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              ▲                                        │
│         one volume, five ways to reach it                             │
│                              │                                        │
│  ┌─── Selected per toggle in parameter.ts ─────────────────────────┐  │
│  │                                                                  │  │
│  │  [EC2 ASG]    [Lambda]     [ECS Fargate]  [EKS]      [Batch]    │  │
│  │   NFS mount    S3 AP        S3 AP          Trident    NFS mount │  │
│  │                                             CSI PV              │  │
│  │      ▲            ▲             ▲             ▲          ▲     │  │
│  │  enableEc2   enableLambda   enableEcs    enableEks  enableBatch │  │
│  │   Pattern      Pattern       Pattern      Pattern     Pattern   │  │
│  │                                                                  │  │
│  │  false -> the construct is never instantiated, so no resources   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Compute Patterns

| Pattern         | Access Method        | Use Case                  | Toggle                |
| --------------- | -------------------- | ------------------------- | --------------------- |
| **EC2**         | NFS mount (NFSv4.1)  | Legacy apps, VM migration | `enableEc2Pattern`    |
| **ECS Fargate** | S3 AP (VPC-origin)   | Containerized batch       | `enableEcsPattern`    |
| **EKS**         | Trident CSI (NFS PV) | Kubernetes workloads      | `enableEksPattern`    |
| **Lambda**      | S3 AP (VPC-origin)   | Serverless processing     | `enableLambdaPattern` |
| **Batch**       | NFS mount (EC2)      | Large-scale batch, Spot   | `enableBatchPattern`  |

> **ECS Fargate Note**: Fargate **cannot** mount FSxN NFS directly. Data is accessed via S3 Access Point. If POSIX file operations are required, use the EC2 pattern instead.

### How the toggles work

The storage layer is deployed once and shared. Each compute pattern is a separate construct that the stack instantiates only when its toggle is `true`, so a disabled pattern leaves **no** resources behind — there is nothing to clean up and nothing to pay for.

Set the toggles in `parameter.ts`:

```ts
export const devParameter: AppParameter = {
  // ... storage and monitoring settings ...

  enableEc2Pattern: true, // NFS mount from an Auto Scaling group
  enableLambdaPattern: true, // S3 Access Point from Lambda
  enableEcsPattern: false, // not deployed
  enableEksPattern: false, // not deployed
  enableBatchPattern: false, // not deployed
};
```

The stack reads them directly:

```ts
if (props.enableEc2Pattern) {
  new ComputeEc2(this, 'ComputeEc2', { ... });
}
```

Changing a toggle and re-running `npx cdk deploy` adds or removes that pattern. The FSx for ONTAP file system, its NFS volume, and the S3 Access Point are untouched, so **the data stays in place while the compute around it changes**. That is the point of this sample: you can move a workload from EC2 to containers without migrating the storage.

### What each toggle adds

Always deployed, regardless of toggles:

- FSx for ONTAP file system, SVM, NFS volume, S3 Access Point
- KMS CMK, VPC with isolated subnets, security groups
- S3 gateway endpoint and CloudWatch Logs interface endpoint
- CapacityManager (auto-expand), AWS Backup plan, 3 CloudWatch alarms + SNS

Each toggle then adds only its own resources:

| Toggle                | Adds                                            | Extra VPC endpoints      |
| --------------------- | ----------------------------------------------- | ------------------------ |
| `enableEc2Pattern`    | Auto Scaling group, launch template, IAM role   | SSM, SSM Messages        |
| `enableLambdaPattern` | Lambda function, IAM role scoped to the S3 AP   | none                     |
| `enableEcsPattern`    | ECS cluster, Fargate service, task definition   | ECR, ECR Docker          |
| `enableEksPattern`    | EKS cluster (L1 `CfnCluster`), cluster IAM role | none (Trident is manual) |
| `enableBatchPattern`  | Batch compute environment, job queue, job def   | none                     |

Measured CloudFormation resource counts (`cdk synth`, `SINGLE_AZ_1`):

| Configuration                                        | Resources | VPC endpoints |
| ---------------------------------------------------- | --------- | ------------- |
| All patterns off (storage only)                      | 32        | 2             |
| EC2 only                                             | 40        | 4             |
| EC2 + Lambda (`devParameter` default)                | 44        | 4             |
| EC2 + Lambda + ECS + Batch (`prodParameter` default) | 64        | 6             |
| All five patterns on                                 | 66        | 6             |

EKS adds only 2 resources because the cluster is an L1 `CfnCluster`; node groups and the Trident CSI driver are installed separately (see below).

### Staged adoption example

The toggles exist so that one stack can follow a migration instead of being rebuilt at each step. A typical sequence:

| Stage                         | Toggles turned on       | What you get                                                      |
| ----------------------------- | ----------------------- | ----------------------------------------------------------------- |
| 1. Lift and shift from VMware | `enableEc2Pattern`      | EC2 mounts the NFS volume; application code unchanged             |
| 2. Add serverless processing  | `+ enableLambdaPattern` | Lambda reads the same data via the S3 Access Point, no NFS needed |
| 3. Containerize               | `+ enableEcsPattern`    | Fargate tasks use the S3 Access Point alongside the EC2 fleet     |
| 4. Add scheduled batch        | `+ enableBatchPattern`  | Batch mounts NFS on EC2 launch type, Spot optional                |
| 5. Move to Kubernetes         | `+ enableEksPattern`    | EKS mounts the same volume through Trident CSI                    |

At every stage the earlier patterns keep working, because all of them address one FSx for ONTAP volume. Stage 1 and stage 5 read the same files.

### ECS Fargate Production Setup

By default, ECS Service is deployed with `desiredCount: 0`. To go to production:

1. Verify ECR VPC Endpoints are active (`enableEcsPattern: true` creates them automatically)
2. Push container images to Private ECR (Public ECR is not supported via VPC Endpoint)
3. Set `desiredCount` in `parameter.ts` to 1 or more
4. Run `npx cdk deploy` to update

> ⏱️ Initial deployment takes 20–35 minutes. The majority of this time is FSx for ONTAP file system provisioning.

## Cost Estimate

Rough order of magnitude only. Verify against the AWS Pricing Calculator for your region and configuration.

| Configuration                                  | Monthly Cost (USD) |
| ---------------------------------------------- | ------------------ |
| Minimum (FSxN + EC2 + Lambda, `devParameter`)  | ~$550              |
| Full (all patterns on, `prodParameter` sizing) | ~$2,000            |

Interface endpoints are billed per endpoint per AZ; the S3 gateway endpoint is free. This sample deploys 1 interface endpoint with all patterns off, 3 with EC2 on, and 5 with both EC2 and ECS on.

## Expected Benefits

| Metric                        | Before (VMware)        | After (AWS + FSxN)          |
| ----------------------------- | ---------------------- | --------------------------- |
| Storage management effort     | Manual operations      | CapacityManager auto-expand |
| Data copies                   | Duplicated per service | Single shared storage       |
| Dev/Test environment creation | Hours                  | Instant via FlexClone       |
| Cost efficiency               | Fixed infrastructure   | FabricPool + Spot           |

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
