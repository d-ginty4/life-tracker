locals {
  availability_zone = var.availability_zone != "" ? var.availability_zone : "${var.aws_region}a"
  ssh_cidrs         = length(var.ssh_cidrs) > 0 ? var.ssh_cidrs : var.allowed_cidrs
}

resource "aws_lightsail_key_pair" "app" {
  name       = "${var.project_name}-key"
  public_key = var.ssh_public_key
}

resource "aws_lightsail_instance" "app" {
  name              = var.project_name
  availability_zone = local.availability_zone
  blueprint_id      = var.blueprint_id
  bundle_id         = var.bundle_id
  key_pair_name     = aws_lightsail_key_pair.app.name
  user_data         = templatefile("${path.module}/templates/user-data.sh.tpl", {
    project_name = var.project_name
  })

  tags = {
    Name = var.project_name
  }
}

resource "aws_lightsail_static_ip" "app" {
  name = "${var.project_name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "app" {
  static_ip_name = aws_lightsail_static_ip.app.name
  instance_name  = aws_lightsail_instance.app.name
}

resource "aws_lightsail_instance_public_ports" "app" {
  instance_name = aws_lightsail_instance.app.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = local.ssh_cidrs
  }

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
    cidrs     = var.allowed_cidrs
  }

  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
    cidrs     = var.allowed_cidrs
  }
}
