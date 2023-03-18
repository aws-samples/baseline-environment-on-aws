'use strict';

const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const ddb = new AWS.DynamoDB();

module.exports.putItem = (event, context, callback) => {
  var datetime = new Date(Date.now()).toString();
  const request = JSON.parse(event.body);
  const params = {
    TableName: process.env.DDB_TABLE,
    Item: {
      title: { S: request.title },
      content: { S: request.content },
      created_at: { S: datetime },
    },
  };
  ddb.putItem(params, (error, result) => {
    console.log(params);
    if (error) {
      console.error(error);
    } else {
      console.log('Success', result);
      const response = {
        statusCode: 200,
        body: JSON.stringify('Success to putItem to the DynamoDB'),
      };
      callback(null, response);
    }
  });
};
