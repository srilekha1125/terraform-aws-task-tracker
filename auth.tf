resource "aws_cognito_user_pool" "task_users" {
  name           = "task-tracker-users"
  user_pool_tier = "LITE"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = {
    Project = "TaskTracker"
  }
}
resource "aws_cognito_user_pool_client" "task_website" {
  name         = "task-tracker-website"
  user_pool_id = aws_cognito_user_pool.task_users.id

  generate_secret = false

  supported_identity_providers = ["COGNITO"]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  callback_urls = [
    "http://localhost:8000/",
    "https://d3ggi3c7to5s7a.cloudfront.net/"
  ]

  logout_urls = [
    "http://localhost:8000/",
    "https://d3ggi3c7to5s7a.cloudfront.net/"
  ]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
}
resource "aws_cognito_user_pool_domain" "task_login" {
  domain       = "sri-task-tracker-564343772519"
  user_pool_id = aws_cognito_user_pool.task_users.id
}