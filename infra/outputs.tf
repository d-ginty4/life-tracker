output "app_url" {
  description = "HTTPS URL for the app (CloudFront)."
  value       = module.components.app_url
}

output "web_bucket" {
  description = "S3 bucket for frontend static assets."
  value       = module.components.web_bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation."
  value       = module.components.cloudfront_distribution_id
}
