resource "aws_apigatewayv2_api" "task_api" {
  name          = "task-tracker-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [
      "http://localhost:8000",
      "https://d3ggi3c7to5s7a.cloudfront.net"
    ]
    allow_methods = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 300
  }
}
resource "aws_apigatewayv2_integration" "task_lambda" {
  api_id                 = aws_apigatewayv2_api.task_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.task_api.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "task_routes" {
  for_each = toset([
    "POST /tasks",
    "GET /tasks",
    "GET /tasks/{task_id}",
    "PATCH /tasks/{task_id}",
    "DELETE /tasks/{task_id}"
  ])

  api_id    = aws_apigatewayv2_api.task_api.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.task_lambda.id}"

  authorization_type   = "JWT"
  authorizer_id        = aws_apigatewayv2_authorizer.task_users.id
  authorization_scopes = ["openid"]
}
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowTaskApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.task_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.task_api.execution_arn}/*/*"
}
resource "aws_apigatewayv2_stage" "task_api" {
  api_id      = aws_apigatewayv2_api.task_api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 5
    throttling_rate_limit  = 2
  }

  depends_on = [
    aws_apigatewayv2_route.task_routes,
    aws_lambda_permission.api_gateway
  ]
}
resource "aws_apigatewayv2_authorizer" "task_users" {
  api_id           = aws_apigatewayv2_api.task_api.id
  name             = "task-tracker-cognito"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [
      aws_cognito_user_pool_client.task_website.id
    ]

    issuer = "https://cognito-idp.us-east-2.amazonaws.com/${aws_cognito_user_pool.task_users.id}"
  }
}