import json
import os
import boto3
from botocore.exceptions import ClientError
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes import APIGatewayProxyEvent
from boto3.dynamodb.conditions import Key, Attr

logger = Logger()
tracer = Tracer()

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["DDB_TABLE"])

@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler

def lambda_handler(event: APIGatewayProxyEvent, context: LambdaContext) -> Dict[str, Any]:
  logger.info('info')
  logger.debug('debug')

  try:
    response = table.query(
      KeyConditionExpression=Key('title').eq(event['pathParameters']['title']),
    )
    print(response)
  except ClientError as e:
    print(e.response['Error']['Message'])
  else:
    return {
      "statusCode": 200,
      "body" : json.dumps(response["Items"])
    }