data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_subnet" "default" {
  id = data.aws_subnets.default.ids[0]
}

resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda"
  description = "Lambda function security group"
  vpc_id      = data.aws_vpc.default.id

  egress {
    description = "NFS to EFS"
    from_port   = 2049
    to_port     = 2049
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }
}

resource "aws_security_group" "efs" {
  name        = "${var.project_name}-efs"
  description = "EFS mount target security group"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "NFS from Lambda"
    from_port       = 2049
    to_port         = 2049
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_efs_file_system" "data" {
  encrypted = true

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }
}

resource "aws_efs_mount_target" "data" {
  file_system_id  = aws_efs_file_system.data.id
  subnet_id       = data.aws_subnet.default.id
  security_groups = [aws_security_group.efs.id]
}

resource "aws_efs_access_point" "data" {
  file_system_id = aws_efs_file_system.data.id

  root_directory {
    path = "/life-tracker"
    creation_info {
      owner_gid   = 993
      owner_uid   = 993
      permissions = "755"
    }
  }

  posix_user {
    gid = 993
    uid = 993
  }
}
