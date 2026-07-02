// Every Technology-icon id, as a lightweight first-load set — the full defs
// (colour + glyph markup) live in the async tech-icon-catalog module.
// `isTechIconId` gates paths that cannot wait for that chunk: the editor's
// coloured-vs-line-art render dispatch, drag fold-into-shape exclusion and
// telemetry typing, and the diagram package's connector geometry (a tech
// icon's arrows attach to its fixed-size mark, spec/41). Tech ids carry no
// common prefix ('aws-*' but also bare 'k8s' / 'docker'), so a cheap prefix
// test can't replace a membership check; ~68 short strings ≈ 1 kB. A parity
// test (apps/live tech-icons.test.ts) pins this set to the data catalogue's
// ids, so adding an icon without registering its id here fails CI rather
// than silently rendering as the line-art placeholder.
export const TECH_ICON_IDS: ReadonlySet<string> = new Set([
  // ---- AWS ----
  'aws-s3',
  'aws-ec2',
  'aws-lambda',
  'aws-rds',
  'aws-dynamodb',
  'aws-apigateway',
  'aws-cloudfront',
  'aws-route53',
  'aws-vpc',
  'aws-sqs',
  'aws-sns',
  'aws-ecs',
  'aws-eks',
  'aws-cloudwatch',
  'aws-iam',
  // ---- Azure ----
  'azure-vm',
  'azure-blob',
  'azure-appservice',
  'azure-functions',
  'azure-sql',
  'azure-cosmosdb',
  'azure-aks',
  'azure-vnet',
  'azure-loadbalancer',
  'azure-servicebus',
  'azure-keyvault',
  'azure-monitor',
  // ---- Generic infrastructure ----
  'k8s',
  'docker',
  'postgres',
  'mysql',
  'redis',
  'mongodb',
  'kafka',
  'nginx',
  'rabbitmq',
  'elasticsearch',
  'graphql',
  'github',
  'gitlab',
  'nodejs',
  'react',
  'vercel',
  'supabase',
  'terraform',
  'cassandra',
  'prometheus',
  // ---- Cloudflare ----
  'cf-workers',
  'cf-pages',
  'cf-r2',
  'cf-d1',
  'cf-kv',
  'cf-durable-objects',
  'cf-queues',
  'cf-zero-trust',
  'cf-cdn',
  'cf-dns',
  'cf-waf',
  'cf-workers-ai',
  'cf-images',
  'cf-stream',
  // ---- Firebase ----
  'fb-firestore',
  'fb-realtime-db',
  'fb-auth',
  'fb-functions',
  'fb-hosting',
  'fb-storage',
  'fb-messaging',
]);

// True when the id resolves in the Technology catalogue — render paths use
// it to pick the coloured brand renderer over the line-art one, and the
// diagram package's geometry uses it to attach connectors to the mark.
// Answered from the id set above (NOT the async data), so the answer is
// exact even before the catalogue chunk arrives.
export function isTechIconId(id: string | undefined): boolean {
  return !!id && TECH_ICON_IDS.has(id);
}
