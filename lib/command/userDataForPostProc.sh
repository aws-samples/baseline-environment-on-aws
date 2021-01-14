#!/bin/bash -xe

## Use Amazon Time Sync Service
yum -y erase ntp*
yum -y install chrony
service chronyd start
chkconfig chronyd on

echo Configure the region, necessary especially for GovCloud
aws configure set region ${AWS::Region}

echo Determine whether a certificate needs to be generated
cert_arn=$(aws iam list-server-certificates --query 'ServerCertificateMetadataList[?ServerCertificateName==`non-production-testing-server-cert`].Arn' --output text)
if [[ $(echo "$cert_arn" | grep "non-production-testing-server-cert") != *"non-production-testing-server-cert"* ]]; then
  echo *** Beginnning ELB HTTPS configuration ***
  echo Generating private key...
  sudo openssl genrsa -out /tmp/my-private-key.pem 2048
  echo Creating CSR
  sudo openssl req -sha256 -new -key /tmp/my-private-key.pem -out /tmp/csr.pem -subj "/C=US/ST=Washington/L=Seattle/O=NonProductionTestCert/CN=NonProductionTestCert"
  echo Self-signing certificate...
  sudo openssl x509 -req -days 365 -in /tmp/csr.pem -signkey /tmp/my-private-key.pem -out /tmp/my-certificate.pem
  sudo openssl rsa -in /tmp/my-private-key.pem -outform PEM
  echo Converting private key...
  sudo openssl x509 -inform PEM -in /tmp/my-certificate.pem
  echo Uploading key to AWS IAM and saving ARN to environment variable...
  cert_arn=$(aws iam upload-server-certificate --server-certificate-name non-production-testing-server-cert --query 'ServerCertificateMetadata.Arn' --output text --certificate-body file:///tmp/my-certificate.pem --private-key file:///tmp/my-private-key.pem)
  echo Sleeping so IAM can propogate the certificate...
  sleep 10
  echo Removing key files...
  sudo rm /tmp/*.pem
fi
echo Creating ELB HTTPS listener using the cert stored in the environment variable...
aws elbv2 create-listener --load-balancer-arn ${rALBForWeb} --protocol HTTPS --port 443 --default-actions "Type=forward,TargetGroupArn=${rALBTargetGroupForWeb}" --certificates "CertificateArn=$cert_arn" --region ${AWS::Region}
aws elbv2 create-listener --load-balancer-arn ${rALBForApp} --protocol HTTPS --port 443 --default-actions "Type=forward,TargetGroupArn=${rALBTargetGroupForApp}" --certificates "CertificateArn=$cert_arn" --region ${AWS::Region}
echo Send notification message...
aws sns publish --topic-arn ${pSecurityAlarmTopic} \
  --subject "CloudFormation successfully launched ${AWS::StackName}" \
  --message "What now? Click here for more information: https://${rALBForWeb.DNSName}/landing.html. Please note that the application server might be finishing up its initialization. If the link doesn't respond right away, please try it again in few minutes. This page resides on an application server in your new environment." \
  --region ${AWS::Region}
echo Sleeping for 2 minutes to allow CloudFormation to catch up
sleep 120
echo Self-destruct!
aws ec2 terminate-instances --instance-id $(curl -s http://169.254.169.254/latest/meta-data/instance-id) --region ${AWS::Region}
echo *** ELB HTTPS configuration complete ***