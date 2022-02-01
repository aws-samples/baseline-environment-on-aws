import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { cloudformation_include as cfn_inc } from 'aws-cdk-lib';

export class BLEAConfigCtGuardrailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // https://github.com/awslabs/aws-config-rules/tree/master/aws-config-conformance-packs
    new cfn_inc.CfnInclude(this, 'ConfigCtGr', {
      templateFile: 'cfn/AWS-Control-Tower-Detective-Guardrails.yaml',
    });
  }
}
