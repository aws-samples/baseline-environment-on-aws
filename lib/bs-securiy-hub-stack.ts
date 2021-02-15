import * as cdk from '@aws-cdk/core';
import * as hub from '@aws-cdk/aws-securityhub';
import * as iam from '@aws-cdk/aws-iam';

export class BsSecurityHubStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new iam.CfnServiceLinkedRole(this, 'BsRoleForSecurityHub', {
      awsServiceName: 'securityhub.amazonaws.com',
    });

    new hub.CfnHub(this, 'BsSecurityHub');

  }
}
