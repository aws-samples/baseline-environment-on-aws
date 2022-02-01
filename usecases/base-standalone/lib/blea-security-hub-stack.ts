import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_securityhub as hub } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

export class BLEASecurityHubStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new iam.CfnServiceLinkedRole(this, 'RoleForSecurityHub', {
      awsServiceName: 'securityhub.amazonaws.com',
    });

    new hub.CfnHub(this, 'SecurityHub');
  }
}
