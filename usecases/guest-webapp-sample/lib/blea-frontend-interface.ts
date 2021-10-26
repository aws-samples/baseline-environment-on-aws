import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudfront from '@aws-cdk/aws-cloudfront';

export interface IBLEAFrontend {
  readonly appAlb: elbv2.ApplicationLoadBalancer;
  readonly appAlbListerner: elbv2.ApplicationListener;
  readonly appAlbSecurityGroup: ec2.SecurityGroup;
  readonly webContentsBucket: s3.Bucket;
  readonly cfDistribution: cloudfront.Distribution;
}
