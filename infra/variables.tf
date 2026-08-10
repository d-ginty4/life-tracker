variable "aws_region" {
  type        = string
  description = "AWS region for the Lightsail instance."
  default     = "eu-west-1"
}

variable "project_name" {
  type        = string
  description = "Name prefix for Lightsail resources."
  default     = "health-tracker"
}

variable "availability_zone" {
  type        = string
  description = "Lightsail availability zone (must be in aws_region). Leave empty to use <region>a."
  default     = ""
}

variable "bundle_id" {
  type        = string
  description = <<-EOT
    Lightsail bundle. Cheapest options (as of 2026):
      nano_3_0  (~$3.50/mo, 2 vCPU, 512 MB, 20 GB SSD)
      micro_3_0 (~$5/mo,   2 vCPU, 1 GB,  40 GB SSD) — safer if you enable HTTPS later
  EOT
  default     = "nano_3_0"
}

variable "blueprint_id" {
  type        = string
  description = "Lightsail OS blueprint."
  default     = "ubuntu_24_04"
}

variable "ssh_public_key" {
  type        = string
  description = "SSH public key material for the Lightsail key pair (contents of id_ed25519.pub / id_rsa.pub)."
}

variable "allowed_cidrs" {
  type        = list(string)
  description = "CIDR blocks allowed to reach the instance on HTTP/HTTPS/SSH."
  default     = ["0.0.0.0/0"]
}

variable "ssh_cidrs" {
  type        = list(string)
  description = "CIDR blocks allowed to SSH. Defaults to allowed_cidrs when empty."
  default     = []
}
