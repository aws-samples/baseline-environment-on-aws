import json
import os
import boto3
import pg8000
import ssl
from botocore.exceptions import ClientError
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes import APIGatewayProxyEvent


logger = Logger()
tracer = Tracer()

rds = boto3.client("rds")

region = os.environ["REGION"]
db_user = os.environ["DB_USER"]
db_name = os.environ["DB_NAME"]
db_endpoint = os.environ["DB_ENDPOINT"]
db_port = os.environ["DB_PORT"]

@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler

def lambda_handler(event: APIGatewayProxyEvent, context: LambdaContext) -> Dict[str, Any]:
  logger.info('info')
  logger.debug('debug')
  
  token = rds.generate_db_auth_token(
    DBHostname=db_endpoint,
    Port=db_port,
    DBUsername=db_user,
    Region=region
  )
  
  ssl_context = ssl.SSLContext()
  ssl_context.verify_mode = ssl.CERT_REQUIRED
  ssl_context.load_verify_locations('/opt/python/data/RootCA1.pem')
  
  try:
    conn = pg8000.connect(
        host=db_endpoint, 
        port=db_port, 
        database=db_name, 
        user=db_user, 
        password=token, 
        ssl_context=ssl_context,
    )
  except Exception as e:
    print("Database connection failed due to {}".format(e))
    