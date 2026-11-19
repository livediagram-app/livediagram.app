import { describe, expect, it } from 'vitest';
import { parseHcl } from './hcl';
import { terraformPart } from './terraform';
import { terraformIcon } from './terraform-icons';

const draw = (text: string) => {
  const read = parseHcl(text);
  if (!read.ok) throw new Error(read.error.message);
  return terraformPart(read.body, 'infra');
};
const part = (text: string) => {
  const built = draw(text);
  if (!built.ok) throw new Error(built.error.message);
  return built.part;
};

const MAIN = `
terraform {
  required_providers { aws = { source = "hashicorp/aws" } }
}
provider "aws" { region = "eu-west-2" }
variable "prefix" {}
locals { name = "shop" }

resource "aws_s3_bucket" "assets" {
  bucket = "\${var.prefix}-assets"
}
resource "aws_lambda_function" "api" {
  count = 2
  role = aws_iam_role.lambda.arn
  environment {
    variables = { BUCKET = aws_s3_bucket.assets.id, SELF = aws_lambda_function.api.arn }
  }
  depends_on = [module.vpc]
}
resource "aws_iam_role" "lambda" {
  for_each = toset(["a"])
}
resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.logs.arn
}
resource "aws_iam_policy" "logs" {}
resource "aws_route_table_association" "lonely" {
  subnet_id = var.subnet
}
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}
module "dynamic" {
  source = "\${var.path}"
}
data "aws_ami" "ubuntu" {}
output "url" { value = aws_lambda_function.api.arn }
moved {
  from = a
  to = b
}
something "else" {}
resource "aws_only_one_label" {}
module {}
top_level = 1
`;

describe('terraformPart', () => {
  it('draws resources and modules with their icons and notes', () => {
    const p = part(MAIN);
    expect(p.title).toBe('infra');
    expect(p.nodes).toEqual([
      { id: 'tf-aws-s3-bucket-assets', label: 'assets', icon: 'aws-s3', note: 'aws_s3_bucket' },
      {
        id: 'tf-aws-lambda-function-api',
        label: 'api',
        icon: 'aws-lambda',
        note: 'aws_lambda_function\ncount: 2',
      },
      {
        id: 'tf-aws-iam-role-lambda',
        label: 'lambda',
        icon: 'aws-iam',
        note: 'aws_iam_role\nfor_each',
      },
      { id: 'tf-aws-iam-policy-logs', label: 'logs', icon: 'aws-iam', note: 'aws_iam_policy' },
      {
        id: 'tf-module-vpc',
        label: 'vpc',
        icon: 'terraform',
        note: 'module: terraform-aws-modules/vpc/aws',
      },
      { id: 'tf-module-dynamic', label: 'dynamic', icon: 'terraform' },
    ]);
  });

  it('draws references as arrows and joining resources as dashed lines', () => {
    const p = part(MAIN);
    expect(p.edges).toEqual([
      { from: 'tf-aws-lambda-function-api', to: 'tf-aws-iam-role-lambda' },
      // A block's own attributes are read before its nested blocks.
      { from: 'tf-aws-lambda-function-api', to: 'tf-module-vpc' },
      { from: 'tf-aws-lambda-function-api', to: 'tf-aws-s3-bucket-assets' },
      { from: 'tf-aws-iam-role-lambda', to: 'tf-aws-iam-policy-logs', line: 'dashed' },
    ]);
  });

  it('says what it did not draw, silent about settings', () => {
    expect(part(MAIN).skipped).toEqual([
      { key: 'top_level', count: 1 },
      { key: 'data.aws_ami', count: 1 },
      { key: 'something', count: 1 },
      { key: 'aws_only_one_label', count: 1 },
      { key: 'module', count: 1 },
      { key: 'resource.aws_route_table_association', count: 1 },
    ]);
    expect(part('data {}\nresource "aws_vpc" "v" {}').skipped).toEqual([
      { key: 'data.x', count: 1 },
    ]);
  });

  it('has nothing to draw without a resource or module', () => {
    expect(draw('provider "aws" {}\nvariable "x" {}')).toEqual({
      ok: false,
      error: { code: 'nothing-to-draw', message: 'Found no resource or module to draw.' },
    });
  });

  it('picks the longest matching icon prefix, else Terraform', () => {
    expect(terraformIcon('aws_lb_listener')).toBe('aws-elb');
    expect(terraformIcon('azurerm_linux_function_app')).toBe('azure-functions');
    expect(terraformIcon('azurerm_kubernetes_cluster')).toBe('azure-aks');
    expect(terraformIcon('cloudflare_workers_kv_namespace')).toBe('cf-kv');
    expect(terraformIcon('cloudflare_worker_script')).toBe('cf-workers');
    expect(terraformIcon('google_compute_instance')).toBe('terraform');
  });
});
