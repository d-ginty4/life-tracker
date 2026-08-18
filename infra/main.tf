terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.58.0"
    }
  }

  backend "s3" {
    bucket       = "health-tracker-state-590184097018-eu-west-1-an"
    key          = "terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
  }
}

variable "profile" {
  default = "AdministratorAccess-590184097018"
}

variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "project_name" {
  type    = string
  default = "life-tracker"
}

provider "aws" {
  region  = var.region
  profile = var.profile

  default_tags {
    tags = {
      Project = var.project_name
    }
  }
}

module "components" {
  source = "./components"

  region       = var.region
  project_name = var.project_name
}
