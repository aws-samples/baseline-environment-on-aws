import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib';

export interface IBLEAFrontend {
  readonly appAlb: elbv2.ApplicationLoadBalancer;
  readonly appAlbListerner: elbv2.ApplicationListener;
  readonly appAlbSecurityGroup: ec2.SecurityGroup;
  readonly webContentsBucket: s3.Bucket;
  readonly cfDistribution: cloudfront.Distribution;
}
