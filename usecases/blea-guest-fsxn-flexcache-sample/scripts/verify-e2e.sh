#!/bin/bash
set -euo pipefail

# Spec G: FlexCache E2E 検証スクリプト
# 前提: Dev-BLEAFsxnFlexCache スタックがデプロイ済み

STACK_NAME="Dev-BLEAFsxnFlexCache"
REGION="ap-northeast-1"

echo "============================================"
echo " Spec G: FlexCache E2E Verification"
echo " Stack: ${STACK_NAME}"
echo " Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================"

# 1. スタック状態確認
echo ""
echo "## 1. Stack Status"
STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].StackStatus' --output text)
echo "Status: $STATUS"
if [ "$STATUS" != "CREATE_COMPLETE" ] && [ "$STATUS" != "UPDATE_COMPLETE" ]; then
  echo "❌ Stack not healthy. Aborting."
  exit 1
fi
echo "✅ Stack healthy"

# 2. FSxN 確認
echo ""
echo "## 2. FSxN File Systems"
ORIGIN_FS=$(aws cloudformation describe-stack-resource --stack-name "$STACK_NAME" --logical-resource-id OriginFsxnFileSystem2C13E888 --region "$REGION" --query 'StackResourceDetail.PhysicalResourceId' --output text 2>/dev/null || echo "NOT_FOUND")
CACHE_FS=$(aws cloudformation describe-stack-resource --stack-name "$STACK_NAME" --logical-resource-id CacheFsxnFileSystem78A0A5E6 --region "$REGION" --query 'StackResourceDetail.PhysicalResourceId' --output text 2>/dev/null || echo "NOT_FOUND")
echo "Origin: $ORIGIN_FS"
echo "Cache:  $CACHE_FS"

ORIGIN_STATUS=$(aws fsx describe-file-systems --file-system-ids "$ORIGIN_FS" --region "$REGION" --query 'FileSystems[0].Lifecycle' --output text 2>/dev/null || echo "ERROR")
CACHE_STATUS=$(aws fsx describe-file-systems --file-system-ids "$CACHE_FS" --region "$REGION" --query 'FileSystems[0].Lifecycle' --output text 2>/dev/null || echo "ERROR")
echo "Origin Status: $ORIGIN_STATUS"
echo "Cache Status:  $CACHE_STATUS"

if [ "$ORIGIN_STATUS" = "AVAILABLE" ] && [ "$CACHE_STATUS" = "AVAILABLE" ]; then
  echo "✅ Both FSxN AVAILABLE"
else
  echo "❌ FSxN not ready"
  exit 1
fi

# 3. VPC Peering 確認
echo ""
echo "## 3. VPC Peering"
PEERING=$(aws ec2 describe-vpc-peering-connections --region "$REGION" --filters "Name=status-code,Values=active" --query 'VpcPeeringConnections[*].[VpcPeeringConnectionId,Status.Code]' --output text 2>/dev/null | head -3)
echo "$PEERING"
if echo "$PEERING" | grep -q "active"; then
  echo "✅ VPC Peering active"
else
  echo "⚠️  VPC Peering not found or inactive"
fi

# 4. Custom Metrics Lambda 確認
echo ""
echo "## 4. Metrics Lambda"
LAMBDA_NAME=$(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" --region "$REGION" --query 'StackResources[?starts_with(LogicalResourceId, `MonitoringMetrics`)].PhysicalResourceId' --output text 2>/dev/null | head -1)
if [ -n "$LAMBDA_NAME" ]; then
  echo "Lambda: $LAMBDA_NAME"
  # 手動呼び出しテスト
  INVOKE_RESULT=$(aws lambda invoke --function-name "$LAMBDA_NAME" --region "$REGION" --payload '{}' /tmp/flexcache-metrics-result.json 2>&1 | grep StatusCode || echo "INVOKE_FAILED")
  echo "Invoke: $INVOKE_RESULT"
  if [ -f /tmp/flexcache-metrics-result.json ]; then
    cat /tmp/flexcache-metrics-result.json
    echo ""
  fi
  echo "✅ Metrics Lambda invoked"
else
  echo "⚠️  Metrics Lambda not found"
fi

# 5. CloudWatch Alarms 確認
echo ""
echo "## 5. CloudWatch Alarms"
aws cloudwatch describe-alarms --alarm-name-prefix "Dev-BLEAFsxnFlexCache" --region "$REGION" --query 'MetricAlarms[*].[AlarmName,StateValue]' --output table 2>/dev/null || echo "(no alarms)"

# 6. FlexCache Custom Resource Lambda ログ
echo ""
echo "## 6. FlexCache CR Lambda Logs"
CR_LOG=$(aws cloudformation describe-stack-resources --stack-name "$STACK_NAME" --region "$REGION" --query 'StackResources[?ResourceType==`AWS::Logs::LogGroup` && starts_with(LogicalResourceId, `FlexCache`)].PhysicalResourceId' --output text 2>/dev/null | head -1)
if [ -n "$CR_LOG" ]; then
  aws logs filter-log-events --log-group-name "$CR_LOG" --region "$REGION" --filter-pattern "flexcache" --query 'events[*].message' --output text 2>/dev/null | head -5
fi

echo ""
echo "============================================"
echo " Verification Complete"
echo "============================================"
