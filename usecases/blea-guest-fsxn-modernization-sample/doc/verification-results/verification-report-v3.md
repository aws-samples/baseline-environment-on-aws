# Spec H: Modernization Platform — E2E Verification Report v3

## Summary

| Item | Value |
|------|-------|
| Stack | Dev-BLEAFsxnModernization |
| Region | ap-northeast-1 |
| Resources | 61 |
| Status | ✅ CREATE_COMPLETE + UPDATE_COMPLETE |
| Date | 2026-06-06 |

## E2E Verification Results

| Test | Result | Evidence |
|------|--------|----------|
| Lambda → S3 AP (ListObjects) | ✅ | `{"statusCode":200,"body":"{\"fileCount\":0}"}` |
| CloudWatch Alarms (3) | ✅ | CPU: OK, Throughput: OK, Storage: INSUFFICIENT_DATA |
| ECS Cluster created | ✅ | Cluster ARN confirmed |
| Batch ComputeEnv created | ✅ | VALID state |
| EC2 ASG created | ✅ | (deployment confirmed) |
| CapacityManager Lambda | ⚠️ | ETIMEDOUT — needs FSx Interface VPC Endpoint |
| S3 AP AVAILABLE | ✅ | alias: fsxn-platform-de-...-ext-s3alias |

## Key Fixes Applied During Verification

1. **S3 AP Alias in Lambda env**: Fixed from hardcoded placeholder to CDK Token (`getAtt('S3AccessPoint.Alias')`)
2. **Backup Vault RemovalPolicy**: Changed from RETAIN to DESTROY to prevent redeployment conflicts
3. **ECR VPC Endpoints**: Added for ECS Fargate pattern

## Known Limitations

- **CapacityManager**: Requires `com.amazonaws.<region>.fsx` Interface VPC Endpoint for FSx API calls from isolated subnet. Not added by default (cost: ~$14/month per endpoint).
- **ECS Service desiredCount: 0**: Public ECR images cannot be pulled without ECR VPC Endpoints. Use Private ECR in production.

## License

MIT-0
