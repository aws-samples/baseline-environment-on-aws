#!/bin/bash
set -euo pipefail

# Spec H: Modernization Platform E2E 検証スクリプト

STACK_NAME="Dev-BLEAFsxnModernization"
REGION="ap-northeast-1"

echo "============================================"
echo " Spec H: Modernization E2E Verification"
echo " Stack: ${STACK_NAME}"
echo " Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"

# 1. スタック状態確認
echo ""
echo "## 1. Stack Status"
STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].StackStatus' --output text 2>&1)
echo "Status: $STATUS"

# 2. Lambda → S3 AP 検証
echo ""
echo "## 2. Lambda → S3 Access Point"
LAMBDA_NAME=$(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" --region "$REGION" --query 'StackResources[?LogicalResourceId==`ComputeLambdaFileProcessorFC3A9E3E`].PhysicalResourceId' --output text 2>/dev/null || echo "")
if [ -n "$LAMBDA_NAME" ]; then
  echo "Lambda: $LAMBDA_NAME"
  RESULT=$(aws lambda invoke --function-name "$LAMBDA_NAME" --region "$REGION" --payload '{}' /tmp/modernization-lambda-result.json 2>&1 | grep StatusCode || echo "FAILED")
  echo "Invoke: $RESULT"
  if [ -f /tmp/modernization-lambda-result.json ]; then
    echo "Response:"
    cat /tmp/modernization-lambda-result.json
    echo ""
  fi
else
  echo "⚠️ Lambda not found"
fi

# 3. CapacityManager Lambda 検証
echo ""
echo "## 3. CapacityManager Lambda"
CAP_LAMBDA=$(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" --region "$REGION" --query 'StackResources[?starts_with(LogicalResourceId, `ServerlessOpsCapacityManager`)  && ResourceType==`AWS::Lambda::Function`].PhysicalResourceId' --output text 2>/dev/null || echo "")
if [ -n "$CAP_LAMBDA" ]; then
  echo "Lambda: $CAP_LAMBDA"
  # Dry-run: CapacityManager はデフォルトで拡張上限チェックのみ
  CAP_RESULT=$(aws lambda invoke --function-name "$CAP_LAMBDA" --region "$REGION" --payload '{}' /tmp/capacity-result.json 2>&1 | grep StatusCode || echo "FAILED")
  echo "Invoke: $CAP_RESULT"
  if [ -f /tmp/capacity-result.json ]; then
    echo "Response:"
    cat /tmp/capacity-result.json
    echo ""
  fi
else
  echo "⚠️ CapacityManager not found"
fi

# 4. CloudWatch Alarms
echo ""
echo "## 4. CloudWatch Alarms"
aws cloudwatch describe-alarms --alarm-name-prefix "Dev-BLEAFsxnModernization" --region "$REGION" --query 'MetricAlarms[*].[AlarmName,StateValue]' --output table 2>/dev/null

# 5. ECS Cluster 確認
echo ""
echo "## 5. ECS Cluster"
aws ecs list-clusters --region "$REGION" --query 'clusterArns[?contains(@, `Modernization`)]' --output text 2>/dev/null

# 6. Batch 確認
echo ""
echo "## 6. AWS Batch"
aws batch describe-compute-environments --region "$REGION" --query 'computeEnvironments[?starts_with(computeEnvironmentName, `Dev-BLEA`)].[computeEnvironmentName,state,status]' --output table 2>/dev/null

echo ""
echo "============================================"
echo " Verification Complete"
echo "============================================"
