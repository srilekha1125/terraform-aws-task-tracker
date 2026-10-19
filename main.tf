provider "aws" {
  region  = "us-east-2"
  profile = "terraform-process"
}
resource "aws_dynamodb_table" "tasks" {
  name         = "task-tracker"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "task_id"

  attribute {
    name = "task_id"
    type = "S"
  }

  tags = {
    Project = "TaskTracker"
  }
}
resource "aws_iam_role" "lambda_role" {
  name = "task-tracker-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}
resource "aws_iam_role_policy" "lambda_tasks" {
  name = "task-tracker-table-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.tasks.arn
      }
    ]
  })
}
resource "aws_lambda_function" "task_api" {
  function_name = "task-tracker-api"
  role          = aws_iam_role.lambda_role.arn

  filename         = "${path.module}/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda.zip")

  handler     = "app.lambda_handler"
  runtime     = "python3.12"
  memory_size = 128
  timeout     = 5

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.tasks.name
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_tasks
  ]
}
resource "aws_iam_role_policy" "lambda_logs" {
  name = "task-tracker-log-access"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:us-east-2:564343772519:log-group:/aws/lambda/task-tracker-api:*"
      }
    ]
  })
}
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/task-tracker-api"
  retention_in_days = 7
}