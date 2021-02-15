import * as cdk from '@aws-cdk/core';
import * as config from '@aws-cdk/aws-config';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';


export class BsConfigStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, 'ConfigRole', {
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSConfigRole')],
    });

    new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      roleArn: role.roleArn,      
      recordingGroup: {
        allSupported: true
      }
    });

    const bucket = new s3.Bucket(this, 'ConfigBucket');

    // Attaches the AWSConfigBucketPermissionsCheck policy statement.
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [role],
      resources: [bucket.bucketArn],
      actions: ['s3:GetBucketAcl'],
    }));

    // Attaches the AWSConfigBucketDelivery policy statement.
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [role],
      resources: [bucket.arnForObjects(`AWSLogs/${cdk.Stack.of(this).account}/Config/*`)],
      actions: ['s3:PutObject'],
      conditions: {
        StringEquals: {
          's3:x-amz-acl': 'bucket-owner-full-control',
        }
      }
    }));

    new config.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      s3BucketName: bucket.bucketName,      
    });    
  }

}
