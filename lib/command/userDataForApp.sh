#!/bin/bash -x

yum update -y
/opt/aws/bin/cfn-init -v --stack ${AWS::StackName} --resource rALBTargetGroupForApp --configsets wordpress_install --region ${AWS::Region}

## Use Amazon Time Sync Service
yum -y erase ntp*
yum -y install chrony
service chronyd start
chkconfig chronyd on

######################################################################
#     NOTE: UPDATE THESE VALUES ACCORDING TO THE COMPLIANCE BODY     #
######################################################################
LANDING_PAGE="/var/www/html/landing.html"
COMPLIANCE_BODY_LABEL="FinTech Reference Architecture"
COMPLIANCE_SURVEY_LINK="fintech"
COMPLIANCE_MATRIX_FILENAME="Please ask to AWS staffs"
######################################################################

# Download the landing page.
sudo wget ${RefArchS3URL}/${RefArchS3BucketName}/${RefArchS3KeyPrefix}/assets/landing/landing.html -O $LANDING_PAGE

# Replace relative image links with links to the production S3 source.
sudo sed -i 's|images|${RefArchS3URL}/${RefArchS3BucketName}/${RefArchS3KeyPrefix}/assets/landing/images|g' $LANDING_PAGE

# Inject the landing page branding label.
sudo sed -i "s|{compliance-body}|$COMPLIANCE_BODY_LABEL|g" $LANDING_PAGE

# Inject the survey link parameter.
sudo sed -i "s|{compliance-body-survey-link}|$COMPLIANCE_SURVEY_LINK|g" $LANDING_PAGE

# Inject the security control matrix file location.
sudo sed -i "s|{compliance-body-matrix}|${RefArchS3URL}/${RefArchS3BucketName}/${RefArchS3KeyPrefix}/assets/$COMPLIANCE_MATRIX_FILENAME|g" $LANDING_PAGE
