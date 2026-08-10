output "public_ip" {
  description = "Static public IP of the Lightsail instance."
  value       = aws_lightsail_static_ip.app.ip_address
}

output "ssh_command" {
  description = "SSH into the instance as ubuntu."
  value       = "ssh ubuntu@${aws_lightsail_static_ip.app.ip_address}"
}

output "app_url" {
  description = "HTTP URL after deploying containers with infra/scripts/deploy.sh."
  value       = "http://${aws_lightsail_static_ip.app.ip_address}"
}

output "instance_name" {
  description = "Lightsail instance name."
  value       = aws_lightsail_instance.app.name
}

output "deploy_hint" {
  description = "Next step after terraform apply."
  value       = "Once the instance is up, from the repo root run: ./infra/scripts/deploy.sh"
}
