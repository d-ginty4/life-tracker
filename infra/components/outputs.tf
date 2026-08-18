output "app_url" {
  description = "HTTPS URL for the app frontend"
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "web_bucket" {
  description = "S3 bucket for frontend static assets"
  value       = aws_s3_bucket.storage.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = aws_cloudfront_distribution.site.id
}
