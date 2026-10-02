// Vendor stencils and library images with a clear livediagram icon
// (docs/specs/020-import-export/drawio-import.md "stencils, icons and unmatched
// shapes"). Pure data plus the lookups over it; the names are draw.io's
// identifiers, taken from its shape libraries.

export type IconMatch = { iconId: string; tech: boolean; caption?: string };

// ---- AWS (mxgraph.aws4.*) ----------------------------------------------------

const AWS: Record<string, string> = {
  s3: 'aws-s3',
  bucket: 'aws-s3',
  bucket_with_objects: 'aws-s3',
  simple_storage_service: 'aws-s3',
  ec2: 'aws-ec2',
  instance: 'aws-ec2',
  instance2: 'aws-ec2',
  instances: 'aws-ec2',
  instances_2: 'aws-ec2',
  lambda: 'aws-lambda',
  lambda_function: 'aws-lambda',
  rds: 'aws-rds',
  aurora: 'aws-rds',
  dynamodb: 'aws-dynamodb',
  api_gateway: 'aws-apigateway',
  cloudfront: 'aws-cloudfront',
  download_distribution: 'aws-cloudfront',
  streaming_distribution: 'aws-cloudfront',
  route_53: 'aws-route53',
  hosted_zone: 'aws-route53',
  vpc: 'aws-vpc',
  sqs: 'aws-sqs',
  queue: 'aws-sqs',
  sns: 'aws-sns',
  topic: 'aws-sns',
  topic_2: 'aws-sns',
  ecs: 'aws-ecs',
  eks: 'aws-eks',
  cloudwatch: 'aws-cloudwatch',
  cloudwatch_2: 'aws-cloudwatch',
  alarm: 'aws-cloudwatch',
  identity_and_access_management: 'aws-iam',
  iam: 'aws-iam',
  role: 'aws-iam',
  data_lake_resource_icon: 'aws-lake-formation',
  lake_formation: 'aws-lake-formation',
  data_lake: 'aws-lake-formation',
  managed_streaming_for_kafka: 'aws-msk',
  msk: 'aws-msk',
};

function awsIcon(name: string): string | undefined {
  if (AWS[name]) return AWS[name];
  if (/^(rds|aurora)_.*instance/.test(name)) return 'aws-rds';
  if (/^dynamodb_/.test(name)) return 'aws-dynamodb';
  if (/^(ec2_)?[a-z0-9]+_instance$/.test(name)) return 'aws-ec2';
  return undefined;
}

// ---- Azure (draw.io's img/lib/azure2/<area>/<Name>.svg images) ---------------

const AZURE: Record<string, string> = {
  virtual_machine: 'azure-vm',
  virtual_machines_classic: 'azure-vm',
  storage_accounts: 'azure-blob',
  storage_accounts_classic: 'azure-blob',
  blob_block: 'azure-blob',
  blob_page: 'azure-blob',
  app_services: 'azure-appservice',
  function_apps: 'azure-functions',
  sql_database: 'azure-sql',
  azure_cosmos_db: 'azure-cosmosdb',
  kubernetes_services: 'azure-aks',
  virtual_networks: 'azure-vnet',
  virtual_networks_classic: 'azure-vnet',
  load_balancers: 'azure-loadbalancer',
  service_bus: 'azure-servicebus',
  key_vaults: 'azure-keyvault',
  monitor: 'azure-monitor',
};

/** An Azure library image path to its icon. */
export function azureImageIcon(image: string): IconMatch | null {
  const m = /img\/lib\/azure2\/[^/]+\/([^/]+)\.svg$/i.exec(image);
  const id = m ? AZURE[m[1]!.toLowerCase()] : undefined;
  return id ? { iconId: id, tech: true } : null;
}

// ---- Kubernetes (mxgraph.kubernetes.*) -----------------------------------------

const K8S_KINDS: Record<string, string> = {
  pod: 'Pod',
  deploy: 'Deployment',
  svc: 'Service',
  ing: 'Ingress',
  ns: 'Namespace',
  node: 'Node',
  pv: 'Persistent Volume',
  pvc: 'Persistent Volume Claim',
  cm: 'ConfigMap',
  secret: 'Secret',
  job: 'Job',
  cronjob: 'CronJob',
  ds: 'DaemonSet',
  sts: 'StatefulSet',
  rs: 'ReplicaSet',
  hpa: 'Horizontal Pod Autoscaler',
  sa: 'Service Account',
  role: 'Role',
  api: 'API Server',
  etcd: 'etcd',
};

// ---- Network (mxgraph.networks.*), line-art icons --------------------------------

const NETWORK: Record<string, string> = {
  server: 'server',
  web_server: 'server',
  mail_server: 'server',
  proxy_server: 'server',
  virtual_server: 'server',
  mainframe: 'server',
  supercomputer: 'server',
  pc: 'monitor',
  desktop_pc: 'monitor',
  virtual_pc: 'monitor',
  monitor: 'monitor',
  laptop: 'monitor',
  mobile: 'smartphone',
  phone_1: 'smartphone',
  phone_2: 'smartphone',
  tablet: 'smartphone',
  users: 'users',
  user_male: 'user',
  user_female: 'user',
  firewall: 'shield',
  storage: 'hard-drive',
  server_storage: 'hard-drive',
  external_storage: 'hard-drive',
  nas_filer: 'hard-drive',
  tape_storage: 'hard-drive',
  terminal: 'terminal',
  secured: 'lock',
  unsecure: 'unlock',
  security_camera: 'camera',
  wireless_hub: 'wifi',
};

// ---- Marks (mxgraph.basic.*), line-art icons -------------------------------------

const MARKS: Record<string, string> = {
  'mxgraph.basic.x': 'x',
  'mxgraph.basic.tick': 'check',
};

/** A stencil (the resolved shape name plus the style's icon keys) to its icon. */
export function stencilIcon(
  shape: string,
  keys: { resIcon?: string; prIcon?: string },
): IconMatch | null {
  if (shape.startsWith('mxgraph.aws4.')) {
    const own = shape.slice('mxgraph.aws4.'.length);
    const inner =
      own === 'resourceIcon' ? keys.resIcon : own === 'productIcon' ? keys.prIcon : undefined;
    const name = inner ? inner.replace(/^mxgraph\.aws4\./, '') : own;
    const id = awsIcon(name);
    return id ? { iconId: id, tech: true } : null;
  }
  if (shape.startsWith('mxgraph.kubernetes.')) {
    const kind = keys.prIcon;
    return {
      iconId: 'k8s',
      tech: true,
      ...(kind ? { caption: K8S_KINDS[kind] ?? readableStencilName(kind) } : {}),
    };
  }
  if (MARKS[shape]) return { iconId: MARKS[shape], tech: false };
  if (shape.startsWith('mxgraph.networks.')) {
    const id = NETWORK[shape.slice('mxgraph.networks.'.length)];
    return id ? { iconId: id, tech: false } : null;
  }
  return null;
}

/** `mxgraph.cisco.routers.router` → `router`; a custom stencil has no name. */
export function readableStencilName(shape: string): string {
  if (shape.startsWith('stencil(')) return 'custom stencil';
  const last = shape.split('.').pop() ?? shape;
  return last.replace(/[_-]+/g, ' ').trim() || shape;
}
