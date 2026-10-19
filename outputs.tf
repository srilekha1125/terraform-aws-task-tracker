output "api_url" {
  description = "Base URL of the Task Tracker HTTP API"
  value       = aws_apigatewayv2_api.task_api.api_endpoint
}
output "cognito_user_pool_id" {
  description = "User pool for Task Tracker website accounts"
  value       = aws_cognito_user_pool.task_users.id
}

output "cognito_client_id" {
  description = "Public app client ID for the website"
  value       = aws_cognito_user_pool_client.task_website.id
}

output "cognito_login_url" {
  description = "Base address of the Cognito sign-in service"
  value       = "https://${aws_cognito_user_pool_domain.task_login.domain}.auth.us-east-2.amazoncognito.com"
}
output "website_url" {
  description = "Public HTTPS address of the Task Tracker website"
  value       = "https://${aws_cloudfront_distribution.website.domain_name}"
}

output "website_bucket_name" {
  description = "S3 bucket storing the website files"
  value       = aws_s3_bucket.website.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for website updates"
  value       = aws_cloudfront_distribution.website.id
}