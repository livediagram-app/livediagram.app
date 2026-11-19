// A Terraform resource's technology icon from its type (docs/specs/020-import-export/infrastructure-import.md
// "Terraform"). Pure data: the longest prefix below that the type starts with names the icon; a type no prefix
// matches wears the Terraform icon.

const BY_PREFIX: readonly (readonly [prefix: string, icon: string])[] = [
  ['aws_s3_', 'aws-s3'],
  ['aws_instance', 'aws-ec2'],
  ['aws_launch_template', 'aws-ec2'],
  ['aws_autoscaling_group', 'aws-ec2'],
  ['aws_lambda_', 'aws-lambda'],
  ['aws_db_', 'aws-rds'],
  ['aws_rds_', 'aws-rds'],
  ['aws_dynamodb_', 'aws-dynamodb'],
  ['aws_api_gateway_', 'aws-apigateway'],
  ['aws_apigatewayv2_', 'aws-apigateway'],
  ['aws_cloudfront_', 'aws-cloudfront'],
  ['aws_route53_', 'aws-route53'],
  ['aws_vpc', 'aws-vpc'],
  ['aws_subnet', 'aws-vpc'],
  ['aws_internet_gateway', 'aws-vpc'],
  ['aws_nat_gateway', 'aws-vpc'],
  ['aws_security_group', 'aws-vpc'],
  ['aws_sqs_', 'aws-sqs'],
  ['aws_sns_', 'aws-sns'],
  ['aws_ecs_', 'aws-ecs'],
  ['aws_eks_', 'aws-eks'],
  ['aws_cloudwatch_', 'aws-cloudwatch'],
  ['aws_iam_', 'aws-iam'],
  ['aws_msk_', 'aws-msk'],
  ['aws_lb', 'aws-elb'],
  ['aws_alb', 'aws-elb'],
  ['aws_elb', 'aws-elb'],
  ['aws_elasticache_', 'aws-elasticache'],
  ['aws_cognito_', 'aws-cognito'],
  ['aws_kinesis_', 'aws-kinesis'],
  ['aws_sfn_', 'aws-step-functions'],
  ['aws_secretsmanager_', 'aws-secrets-manager'],
  ['azurerm_linux_virtual_machine', 'azure-vm'],
  ['azurerm_windows_virtual_machine', 'azure-vm'],
  ['azurerm_virtual_machine', 'azure-vm'],
  ['azurerm_storage_', 'azure-blob'],
  ['azurerm_app_service', 'azure-appservice'],
  ['azurerm_linux_web_app', 'azure-appservice'],
  ['azurerm_windows_web_app', 'azure-appservice'],
  ['azurerm_function_app', 'azure-functions'],
  ['azurerm_linux_function_app', 'azure-functions'],
  ['azurerm_windows_function_app', 'azure-functions'],
  ['azurerm_mssql_', 'azure-sql'],
  ['azurerm_sql_', 'azure-sql'],
  ['azurerm_cosmosdb_', 'azure-cosmosdb'],
  ['azurerm_kubernetes_cluster', 'azure-aks'],
  ['azurerm_virtual_network', 'azure-vnet'],
  ['azurerm_subnet', 'azure-vnet'],
  ['azurerm_lb', 'azure-loadbalancer'],
  ['azurerm_servicebus_', 'azure-servicebus'],
  ['azurerm_key_vault', 'azure-keyvault'],
  ['azurerm_monitor_', 'azure-monitor'],
  ['cloudflare_worker', 'cf-workers'],
  ['cloudflare_pages_', 'cf-pages'],
  ['cloudflare_r2_', 'cf-r2'],
  ['cloudflare_d1_', 'cf-d1'],
  ['cloudflare_workers_kv', 'cf-kv'],
  ['cloudflare_queue', 'cf-queues'],
  ['cloudflare_record', 'cf-dns'],
  ['cloudflare_dns_', 'cf-dns'],
  ['cloudflare_zone', 'cf-dns'],
  ['kubernetes_', 'k8s'],
  ['helm_release', 'k8s'],
  ['docker_', 'docker'],
];

export const TERRAFORM_DEFAULT_ICON = 'terraform';

export function terraformIcon(type: string): string {
  let best: string | undefined;
  let bestLength = 0;
  for (const [prefix, icon] of BY_PREFIX)
    if (prefix.length > bestLength && type.startsWith(prefix)) {
      best = icon;
      bestLength = prefix.length;
    }
  return best ?? TERRAFORM_DEFAULT_ICON;
}
