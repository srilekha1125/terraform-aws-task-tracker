from boto3.dynamodb.conditions import Attr
import base64
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])


def lambda_handler(event, context):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )

    user_id = claims.get("sub")

    if not user_id:
        return {
            "statusCode": 401,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "Please sign in"})
        }
    if "requestContext" in event:
        route = event.get("routeKey")
        actions = {
            "POST /tasks": "create",
            "GET /tasks": "list",
            "GET /tasks/{task_id}": "get",
            "PATCH /tasks/{task_id}": "update",
            "DELETE /tasks/{task_id}": "delete"
        }

        if route not in actions:
            return {
                "statusCode": 404,
                "body": json.dumps({"message": "Route not found"})
            }

        body = {}

        if actions[route] in ("create", "update"):
            try:
                raw_body = event.get("body") or "{}"

                if event.get("isBase64Encoded"):
                    raw_body = base64.b64decode(
                        raw_body, validate=True
                    ).decode("utf-8")

                body = json.loads(raw_body)

                if not isinstance(body, dict):
                    raise ValueError("Body must be a JSON object")

            except (ValueError, TypeError):
                return {
                    "statusCode": 400,
                    "body": json.dumps({
                        "message": "Please provide a valid JSON object"
                    })
                }

        path_parameters = event.get("pathParameters") or {}

        event = {
            "action": actions[route],
            "task_id": path_parameters.get("task_id"),
            "title": body.get("title"),
            "status": body.get("status")
        }
    if event.get("action") == "list":
        result = table.scan(
	    FilterExpression=Attr("user_id").eq(user_id)
	)
        tasks = result.get("Items", [])

        while result.get("LastEvaluatedKey"):
            result = table.scan(
                FilterExpression=Attr("user_id").eq(user_id),
                ExclusiveStartKey=result["LastEvaluatedKey"]
            )
            tasks.extend(result.get("Items", []))

        tasks.sort(
            key=lambda task: task.get("created_at", ""),
            reverse=True
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"tasks": tasks})
        }
    task_id = event.get("task_id")
    if event.get("action") == "delete":
        if not isinstance(task_id, str) or not task_id.strip():
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Please provide a task ID"})
            }

        try:
            table.delete_item(
                Key={"task_id": task_id},
                ConditionExpression=(
                    "attribute_exists(task_id) AND #owner = :owner"
                ),
                ExpressionAttributeNames={
                    "#owner": "user_id"
                },
                ExpressionAttributeValues={
                    ":owner": user_id
                }
            )
        except ClientError as error:
            if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return {
                    "statusCode": 404,
                    "body": json.dumps({"message": "Task not found"})
                }
            raise

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "message": "Task deleted successfully",
                "task_id": task_id
            })
        }
    if event.get("action") == "update":
        status = event.get("status")

        if not isinstance(task_id, str) or not task_id.strip():
            return {
                "statusCode": 400,
                "body": json.dumps({"message": "Please provide a task ID"})
            }

        if status not in ("Pending", "Completed"):
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "message": "Status must be Pending or Completed"
                })
            }

        try:
            result = table.update_item(
                Key={"task_id": task_id},
                UpdateExpression="SET #s = :s",
                ExpressionAttributeNames={
                    "#s": "status",
                    "#owner": "user_id"
                },
                ExpressionAttributeValues={
                    ":s": status,
                    ":owner": user_id
                },
                ConditionExpression=(
                    "attribute_exists(task_id) AND #owner = :owner"
                ),
                ReturnValues="ALL_NEW"
            )
        except ClientError as error:
            if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return {
                    "statusCode": 404,
                    "body": json.dumps({"message": "Task not found"})
                }
            raise

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(result["Attributes"])
        }

    if task_id:
        result = table.get_item(Key={"task_id": task_id})
        task = result.get("Item")

        if not task or task.get("user_id") != user_id:
            return {
                "statusCode": 404,
                "body": json.dumps({"message": "Task not found"})
            }

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(task)
        }
    title = event.get("title")

    if not isinstance(title, str) or not title.strip():
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Please provide a task title"})
        }

    task = {
        "task_id": str(uuid.uuid4()),
	"user_id": user_id,
        "title": title.strip(),
        "status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    table.put_item(Item=task)

    return {
        "statusCode": 201,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(task)
    }