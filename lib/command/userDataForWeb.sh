#!/bin/bash
yum update -y
/opt/aws/bin/cfn-init -v --stack ${AWS::StackName} --resource rAutoScalingConfigWeb --region ${AWS::Region}

## Use Amazon Time Sync Service
yum -y erase ntp*
yum -y install chrony
service chronyd start
chkconfig chronyd on

## Nginx setup
sleep 5
cp /tmp/nginx/default.conf /etc/nginx/conf.d/default.conf
service nginx stop
sed -i '/default_server;/d' /etc/nginx/nginx.conf
sleep 10
service nginx restart