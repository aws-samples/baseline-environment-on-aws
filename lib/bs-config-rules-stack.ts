import * as cdk from '@aws-cdk/core';
import * as config from '@aws-cdk/aws-config';


export class BsConfigRulesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------------------------------
    const pRequiredTagKey = 'Environment';
    new config.ManagedRule(this, 'check-ec2-for-required-tag', {
      identifier: config.ManagedRuleIdentifiers.REQUIRED_TAGS,
      inputParameters: {
        tag1Key: pRequiredTagKey
      },
      ruleScope: config.RuleScope.fromResources([
        config.ResourceType.EC2_INSTANCE,
        config.ResourceType.EBS_VOLUME
      ]),
      configRuleName: 'check-ec2-for-required-tag',
      description: 'Checks whether EC2 instances and volumes use the required tag.',
    });

    // ------------------------------
    const blockedPort = 3389;
    new config.ManagedRule(this, 'check-for-unrestricted-ports', {
      identifier: config.ManagedRuleIdentifiers.EC2_SECURITY_GROUPS_RESTRICTED_INCOMING_TRAFFIC,
      inputParameters: {
        blockedPort1: blockedPort
      },
      ruleScope: config.RuleScope.fromResources([
        config.ResourceType.EC2_SECURITY_GROUP,
      ]),
      configRuleName: 'check-for-unrestricted-ports',
      description: 'Checks whether security groups that are in use disallow unrestricted incoming TCP traffic to the specified ports.',
    });

    // ------------------------------
    new config.ManagedRule(this, 'check-whether-cloudtrail-is-enabled', {
      identifier: config.ManagedRuleIdentifiers.CLOUDTRAIL_SECURITY_TRAIL_ENABLED,
      configRuleName: 'check-whether-cloudtrail-is-enabled',
      description: 'Checks whether CloudTrail is enabled in this region.',
    });

    // ------------------------------
    new config.ManagedRule(this, 'heck-for-unrestricted-ssh-access', {
      identifier: config.ManagedRuleIdentifiers.EC2_SECURITY_GROUPS_INCOMING_SSH_DISABLED,
      ruleScope: config.RuleScope.fromResources([
        config.ResourceType.EC2_SECURITY_GROUP,
      ]),
      configRuleName: 'heck-for-unrestricted-ssh-access',
      description: 'Checks whether security groups that are in use disallow unrestricted incoming SSH traffic.',
    });
  }
}
