import * as cdk from '@aws-cdk/core';
import * as cfn_inc from '@aws-cdk/cloudformation-include';

export class BLEAConfigCtGuardrailStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // https://github.com/awslabs/aws-config-rules/tree/master/aws-config-conformance-packs
    new cfn_inc.CfnInclude(this, 'ConfigCtGr', {
      templateFile: 'cfn/AWS-Control-Tower-Detective-Guardrails.yaml',
    });
  }
}
