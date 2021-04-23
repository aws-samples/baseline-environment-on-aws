import * as cdk from '@aws-cdk/core';
import * as hub from '@aws-cdk/aws-securityhub';
import * as iam from '@aws-cdk/aws-iam';

export class BLEASecurityHubStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new iam.CfnServiceLinkedRole(this, 'RoleForSecurityHub', {
      awsServiceName: 'securityhub.amazonaws.com',
    });

    new hub.CfnHub(this, 'SecurityHub');
  }
}
