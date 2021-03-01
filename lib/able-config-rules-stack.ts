import * as cdk from '@aws-cdk/core';
import * as config from '@aws-cdk/aws-config';
import * as iam from '@aws-cdk/aws-iam';


export class ABLEConfigRulesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // ConfigRule for Default Security Group is closed  (Same as SecurityHub - need this for auto remediation)
    //
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-4.3
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html
    const ruleDefaultSgClosed = new config.ManagedRule(this, 'ABLERuleDefaultSecurityGroupClosed', {
      identifier: config.ManagedRuleIdentifiers.VPC_DEFAULT_SECURITY_GROUP_CLOSED,
      ruleScope: config.RuleScope.fromResources([
        config.ResourceType.EC2_SECURITY_GROUP,
      ]),
      configRuleName: 'gc-default-security-group-closed',
      description: 'Checks that the default security group of any Amazon Virtual Private Cloud (VPC) does not allow inbound or outbound traffic. The rule is non-compliant if the default security group has one or more inbound or outbound traffic.',
    });

    // Role for auto remediation
    const rmDefaultSgRole = new iam.Role(this, 'RemoveSecGroupRemediationRole', {
      assumedBy: new iam.ServicePrincipal('ssm.amazonaws.com'),
      path: '/',
      managedPolicies: [
        { managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonSSMAutomationRole' },
      ],    
    });
    rmDefaultSgRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "ec2:RevokeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupEgress",
          "ec2:DescribeSecurityGroups",
        ],
        resources: ["*"]
        }));
    rmDefaultSgRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [ "iam:PassRole" ],
        resources: [ rmDefaultSgRole.roleArn ]
      }));
    rmDefaultSgRole.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [ "ssm:StartAutomationExecution" ],
        resources: [ "arn:aws:ssm:::automation-definition/AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules" ]
      }));
  
    // Remediation for Remove VPC Default SecurityGroup Rules  by  SSM Automation
    const remediation = new config.CfnRemediationConfiguration(this, 'RmDefaultSg', {
      configRuleName:  ruleDefaultSgClosed.configRuleName,
      targetType: "SSM_DOCUMENT",
      targetId: "AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules",
      targetVersion: "1",
      parameters: {
        AutomationAssumeRole: {
          StaticValue: {
            Values: [
              rmDefaultSgRole.roleArn
            ]}},
        GroupId: {
          ResourceValue: {
            Value: "RESOURCE_ID"
          }}},
      automatic: true,
      maximumAutomaticAttempts: 5,
      retryAttemptSeconds: 60,
    });

        
  



  }
}
