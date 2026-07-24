import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BLEAFsxnModernizationStack } from '../lib/stack/blea-guest-fsxn-modernization-sample-stack';
import { devParameter } from '../parameter';

const app = new cdk.App();

// Parameter validation
const validThroughputs = [128, 256, 512, 1024, 2048, 4096];
if (!validThroughputs.includes(devParameter.fsxnThroughputCapacityMBps)) {
  throw new Error(`Invalid throughput: ${devParameter.fsxnThroughputCapacityMBps}`);
}
if (devParameter.fsxnStorageCapacityGiB < 1024) {
  throw new Error(`Storage must be >= 1024 GiB`);
}
if (
  !devParameter.enableEc2Pattern &&
  !devParameter.enableLambdaPattern &&
  !devParameter.enableEcsPattern &&
  !devParameter.enableEksPattern &&
  !devParameter.enableBatchPattern
) {
  throw new Error('At least one compute pattern must be enabled');
}

new BLEAFsxnModernizationStack(app, 'Dev-BLEAFsxnModernization', {
  description: 'BLEA FSxN Modernization Platform (tag:blea-guest-fsxn-modernization-sample)',
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },
  ...devParameter,
});
