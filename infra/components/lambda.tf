locals {
  efs_mount_path = "/mnt/efs"
  database_path  = "${local.efs_mount_path}/life-tracker.sqlite"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      identifiers = ["lambda.amazonaws.com"]
      type        = "Service"
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${var.project_name}-lambda-execution-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "basic_permissions" {
  role       = aws_iam_role.lambda_role.id
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc_permissions" {
  role       = aws_iam_role.lambda_role.id
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "efs_access" {
  name = "${var.project_name}-lambda-efs"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite",
      ]
      Resource = aws_efs_access_point.data.arn
    }]
  })
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.project_name}-api-controller"
  role             = aws_iam_role.lambda_role.arn
  timeout          = 30
  memory_size      = 128
  runtime          = "nodejs24.x"
  handler          = "index.handler"
  filename         = "${path.module}/lambda/lambda.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda/lambda.zip")

  # reserved_concurrent_executions = 1
  # Requires enough account concurrency to leave >=10 unreserved (default pool is 1000).
  # Omitted here because small accounts hit: "decreases UnreservedConcurrentExecution below minimum of 10".

  vpc_config {
    subnet_ids         = [data.aws_subnet.default.id]
    security_group_ids = [aws_security_group.lambda.id]
  }

  file_system_config {
    arn              = aws_efs_access_point.data.arn
    local_mount_path = local.efs_mount_path
  }

  environment {
    variables = {
      DATABASE_URL = local.database_path
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.vpc_permissions,
    aws_iam_role_policy.efs_access,
  ]
}

resource "aws_lambda_permission" "api_gateway" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.gateway.execution_arn}/*/*"
}
