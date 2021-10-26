'use strict';

const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const ddb = new AWS.DynamoDB();
const params = {
  TableName: process.env.DDB_TABLE,
};

module.exports.listItems = (event, context, callback) => {
  ddb.scan(params, (error, result) => {
    if (error) {
      console.error(error);
      const response = {
        statusCode: error.statusCode,
        body: error.message,
      };
      callback(null, response);
    } else {
      console.log('Success', result.Items);
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Items),
      };
      callback(null, response);
    }
  });
};
