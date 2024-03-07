import * as cdk from 'aws-cdk-lib';
import { BLEAGovBaseCtScStack as BLEAGovBaseCtScStack } from '../lib/stack/blea-gov-base-ct-via-service-catalog-stack';

// Import parameters for each enviroment
import { devParameter } from '../parameter';

const app = new cdk.App();

// Create stack for "Dev" environment.
// If you have multiple environments, instantiate stacks with its parameters.
new BLEAGovBaseCtScStack(app, 'Dev-BLEAGovBaseCtSc', {
  description:
    'Service Catalog stack for BLEA Governance Base for multi-accounts (uksb-1tupboc58) (tag:blea-gov-base-ct-via-service-catalog)',
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws',
    Environment: devParameter.envName,
  },

  securityNotifyEmail: devParameter.securityNotifyEmail,
});
