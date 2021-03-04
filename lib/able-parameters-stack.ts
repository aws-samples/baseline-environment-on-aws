import * as cdk from '@aws-cdk/core';

export class ABLEParametersStack extends cdk.Stack {
  public readonly Environment: string;

  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const paramsEnvironment = new cdk.CfnParameter(this, 'Environment', {
      type: 'String',
      default: 'dev',
      description: 'Environment name'
    });
    this.Environment = paramsEnvironment.valueAsString;

  }
}
