import * as cdk from '@aws-cdk/core';
import * as cfn_inc from '@aws-cdk/cloudformation-include';
import * as iam from '@aws-cdk/aws-iam';
import { SERVFAIL } from 'dns';


export class NiscIamStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SysAdmin
    const sysAdminPolicyJSON = {
      "Version": "2012-10-17",
      "Statement": [
          {
              "Condition": {
                  "Bool": {
                      "aws:MultiFactorAuthPresent": "true"
                  }
              },
              "Resource": "*",
              "Effect": "Allow",
              "NotAction": "iam:*"
          },
          {
              "Action": "aws-portal:*Billing",
              "Resource": "*",
              "Effect": "Deny"
          },
          {
              "Action": [
                  "cloudtrail:DeleteTrail",
                  "cloudtrail:StopLogging",
                  "cloudtrail:UpdateTrail"
              ],
              "Resource": "*",
              "Effect": "Deny"
          },
          {
              "Action": [
                  "kms:Create*",
                  "kms:Revoke*",
                  "kms:Enable*",
                  "kms:Get*",
                  "kms:Disable*",
                  "kms:Delete*",
                  "kms:Put*",
                  "kms:Update*"
              ],
              "Resource": "*",
              "Effect": "Deny"
          }
      ]
    };

    const SysAdminManagedPolicy = new iam.ManagedPolicy(this, 'sysAdminPolicy',{
      document: iam.PolicyDocument.fromJson(sysAdminPolicyJSON)
    })

    const sysAdminRole = new iam.Role(this, 'sysAdminRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    }).addManagedPolicy(SysAdminManagedPolicy);

    const sysAdminGroup = new iam.Group(this, 'sysAdminGroup')
      .addManagedPolicy(SysAdminManagedPolicy);


    // IAM Admin
    const iamAdminPolicyJSON = {
      "Version": "2012-10-17",
      "Statement": [
          {
              "Condition": {
                  "Bool": {
                      "aws:MultiFactorAuthPresent": "true"
                  }
              },
              "Action": "iam:*",
              "Resource": "*",
              "Effect": "Allow"
          },
          {
              "Action": "aws-portal:*Billing",
              "Resource": "*",
              "Effect": "Deny"
          }
      ]
    };
    const iamAdminManagedPolicy = new iam.ManagedPolicy(this, 'iamAdminPolicy', {
      document: iam.PolicyDocument.fromJson(iamAdminPolicyJSON)
    });
    
    const iamAdminRole = new iam.Role(this, 'iamAdminRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    }).addManagedPolicy(iamAdminManagedPolicy);

    const iamAdminGroup = new iam.Group(this, 'iamAdminGroup')
      .addManagedPolicy(iamAdminManagedPolicy);


    // InstanceOps
    const instanceOpsPolicyJSON = {
      "Version": "2012-10-17",
      "Statement": [
          {
              "Action": "ec2:*",
              "Resource": "*",
              "Effect": "Allow"
          },
          {
              "Action": "elasticloadbalancing:*",
              "Resource": "*",
              "Effect": "Allow"
          },
          {
              "Action": "cloudwatch:*",
              "Resource": "*",
              "Effect": "Allow"
          },
          {
              "Action": "autoscaling:*",
              "Resource": "*",
              "Effect": "Allow"
          },
          {
              "Action": [
                  "ec2:CreateVpc*",
                  "ec2:DeleteVpc*",
                  "ec2:ModifyVpc*",
                  "ec2:CreateSubnet*",
                  "ec2:DeleteSubnet*",
                  "ec2:ModifySubnet*",
                  "ec2:Create*Route*",
                  "ec2:DeleteRoute*",
                  "ec2:AssociateRoute*",
                  "ec2:ReplaceRoute*",
                  "ec2:CreateVpn*",
                  "ec2:DeleteVpn*",
                  "ec2:AttachVpn*",
                  "ec2:DetachVpn*",
                  "ec2:CreateNetworkAcl*",
                  "ec2:DeleteNetworkAcl*",
                  "ec2:ReplaceNetworkAcl*",
                  "ec2:*Gateway*",
                  "ec2:*PeeringConnection*"
              ],
              "Resource": "*",
              "Effect": "Deny"
          },
          {
              "Action": "aws-portal:*Billing",
              "Resource": "*",
              "Effect": "Deny"
          },
          {
              "Action": [
                  "kms:Create*",
                  "kms:Revoke*",
                  "kms:Enable*",
                  "kms:Get*",
                  "kms:Disable*",
                  "kms:Delete*",
                  "kms:Put*",
                  "kms:Update*"
              ],
              "Resource": "*",
              "Effect": "Deny"
          }
      ]
  };

  const instanceOpsManagedPolicy = new iam.ManagedPolicy(this, 'instanceOpsPolicy', {
    document: iam.PolicyDocument.fromJson(instanceOpsPolicyJSON)
  });

  const instanceOpsRole = new iam.Role(this, 'instanceOpsRole', {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  }).addManagedPolicy(instanceOpsManagedPolicy);

  const instanceOpsGroup = new iam.Group(this, 'instanceOpsGroup')
    .addManagedPolicy(instanceOpsManagedPolicy);


  // readOnlyAdmin
  const readOnlyAdminPolicyJSON = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "appstream:Get*",
                "autoscaling:Describe*",
                "cloudformation:DescribeStacks",
                "cloudformation:DescribeStackEvents",
                "cloudformation:DescribeStackResource",
                "cloudformation:DescribeStackResources",
                "cloudformation:GetTemplate",
                "cloudformation:List*",
                "cloudfront:Get*",
                "cloudfront:List*",
                "cloudtrail:DescribeTrails",
                "cloudtrail:GetTrailStatus",
                "cloudwatch:Describe*",
                "cloudwatch:Get*",
                "cloudwatch:List*",
                "directconnect:Describe*",
                "dynamodb:GetItem",
                "dynamodb:BatchGetItem",
                "dynamodb:Query",
                "dynamodb:Scan",
                "dynamodb:DescribeTable",
                "dynamodb:ListTables",
                "ec2:Describe*",
                "elasticache:Describe*",
                "elasticbeanstalk:Check*",
                "elasticbeanstalk:Describe*",
                "elasticbeanstalk:List*",
                "elasticbeanstalk:RequestEnvironmentInfo",
                "elasticbeanstalk:RetrieveEnvironmentInfo",
                "elasticloadbalancing:Describe*",
                "elastictranscoder:Read*",
                "elastictranscoder:List*",
                "iam:List*",
                "iam:Get*",
                "kinesis:Describe*",
                "kinesis:Get*",
                "kinesis:List*",
                "opsworks:Describe*",
                "opsworks:Get*",
                "route53:Get*",
                "route53:List*",
                "redshift:Describe*",
                "redshift:ViewQueriesInConsole",
                "rds:Describe*",
                "rds:ListTagsForResource",
                "s3:Get*",
                "s3:List*",
                "sdb:GetAttributes",
                "sdb:List*",
                "sdb:Select*",
                "ses:Get*",
                "ses:List*",
                "sns:Get*",
                "sns:List*",
                "sqs:GetQueueAttributes",
                "sqs:ListQueues",
                "sqs:ReceiveMessage",
                "storagegateway:List*",
                "storagegateway:Describe*",
                "trustedadvisor:Describe*"
            ],
            "Resource": "*",
            "Effect": "Allow"
          },
          {
              "Action": "aws-portal:*Billing",
              "Resource": "*",
              "Effect": "Deny"
          }
       ]
      };

      const readOnlyAdminManagedPolicy = new iam.ManagedPolicy(this, 'readOnlyAdminPolicy', {
        document: iam.PolicyDocument.fromJson(readOnlyAdminPolicyJSON)
      });

      const readOnlyAdminRole = new iam.Role(this, 'readOnlyAdminRole', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      }).addManagedPolicy(readOnlyAdminManagedPolicy);
  
      const readOnlyAdminGroup = new iam.Group(this, 'readOnlyAdminGroup')
        .addManagedPolicy(readOnlyAdminManagedPolicy);

  }
}
