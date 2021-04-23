# How to Migrate ABLE Standalone to AWS Control Tower
## 0. Advance Preperation
### 0.1. Setup Control Tower
	see: https://docs.aws.amazon.com/controltower/latest/userguide/setting-up.html
### 0.2. enable trusted access using the AWS CloudFormation Stacksets console
	see: https://docs.aws.amazon.com/organizations/latest/userguide/services-that-can-integrate-cloudformation.html#integrate-enable-ta-cloudformation  
* Move AWS Organizations console  
* Select [Settings] tab and enable [AWS CloudFormation StackSets] Access

### 0.3. Enable Security Hub in the OU admin
	see: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-settingup.html
### 0.4. Enable GuardDuty
    see: https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_settingup.html


## 1. Enroll ABLE Standalone enabled AWS accounts to the Control Tower
	reference: https://docs.aws.amazon.com/controltower/latest/userguide/enroll-account.html

### 1.1. Preperation - Control Tower Side -

#### Invite your ABLE Standalone AWS account in the Organization
* Login as root user
* In the AWS Organizations Console, press [Add Account] button
* Press [Invite Account]
    * If you do not verify your email address, please verify first
* Fill email address or account ID of ABLE Standalone account and press [invite]
* When you received email, follow instruction and approve invite request

### 1.2 Preperation - ABLE Standalone Side -
#### Disable AWS Config delivery channel on the ABLE Standalone AWS account
* Login to the ABLE Standalone AWS account’s management console and hit CloudShell [>_] icon
![OpenConsole](/doc/img/OpenConsole.png)
* Get delivery channel name and configuration recorder name
```
$ aws configservice describe-delivery-channels
{

    "DeliveryChannels": [

        {

            "name": "ABLE-Config-ConfigDeliveryChannel-XXXXXXXXXXX”,

            "s3BucketName": "able-config-configbucketxxxxxxxxxxxxxx”

        }

    ]

}
$ aws configservice describe-configuration-recorders
{

    "ConfigurationRecorders": [

        {

            "name": "ABLE-Config-ConfigRecorder-XXXXXXXXXXXXXX”,

            "roleARN": "arn:aws:iam::xxxxxxxxxxxx:role/ABLE-Config-ConfigRoleXXXXXXXXXXXXXXXXXX”,

            "recordingGroup": {

                "allSupported": true,

                "includeGlobalResourceTypes": true,

                "resourceTypes": []

            }

        }

    ]

}
```
* Delete configuration recorder and delivery channel
```
$ aws configservice delete-configuration-recorder --configuration-recorder-name ABLE-Config-ConfigRecorder-XXXXXXXXXXXXXX
$ aws configservice delete-delivery-channel --delivery-channel-name ABLE-Config-ConfigDeliveryChannel-XXXXXXXXXXX
```
#### Create AWSControlTowerExecution Role
reference: https://docs.aws.amazon.com/controltower/latest/userguide/enroll-account.html  
    * Prerequisites for Enrollment - 3.
* Move IAM console
* Select [Roles]-[Create Role]
* Select [Another AWS account] and fill Control Tower Admin's AWS account ID
* Hit [Next: Permissions]
* Select 'AdministratorAccess' policy and hit [Next: Tags]-[Next: Review]
* Type 'AWSControlTowerExecution' in the  Role name text box and press [Create role] button


### 1.3 Enroll ABLE Standalone Account to the Control Tower
* Login Control Tower Admin account via AWS SSO
    * You can find SSO portal URL in the Control Tower Console [Users and Access] tab.
    ![SSOURL](/doc/img/SSOURL.png)
    * You can reset password in the AWS SSO Console [Users] tab and click user.
    ![ChangePass](/doc/img/ChangePass.png)
* Move Control Tower console
* Press [Account Factory] on a left sidebar
* Press [Enroll account] and fill information of ABLE Standalone AWS account and hit [Enroll Account] button
![Enroll](/doc/img/Enroll.png)
* If you want to check enroll progress, move Service Catalog console and select [Provisioned Products]
