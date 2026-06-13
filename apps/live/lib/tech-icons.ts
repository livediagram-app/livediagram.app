// Full-colour brand icons for the "Technology" palette category
// (spec/41) — the AWS / Azure / generic-infrastructure marks people put
// on system-architecture diagrams. They are a DELIBERATELY separate
// catalogue from the line-art glyphs in `icons.ts`: those are
// single-weight strokes tinted by the element's stroke colour, whereas
// these are fixed multi-colour brand marks that must NOT be recoloured
// (an orange Lambda only reads as Lambda in orange).
//
// A Technology icon reuses the `shape: 'icon'` element — `element.iconId`
// keys here instead of the line-art catalogue. The render path
// (BoxedElementView → tech-icon-glyph) dispatches on `isTechIconId` so the
// id resolves to the right renderer; an id in neither catalogue still
// falls back to the line-art placeholder.
//
// Each mark is authored in-repo as a brand-coloured rounded tile + a white
// line-art glyph (the AWS resource-icon visual language, applied uniformly
// for a cohesive palette). It is NOT the verbatim vendor asset pack — that
// keeps the bundle small, renders crisply at icon size, and avoids
// redistributing proprietary SVGs from a public MIT repo (spec/03,
// spec/06). Swapping in a vendor's official SVG later is a per-id edit.

// Drag-from-palette MIME for a Technology tile dropped on the canvas.
// Distinct from ICON_DND_MIME so the tile creates a STANDALONE icon
// element and is ignored by the shape drop-target (a coloured brand tile
// beside a shape's text is meaningless, and the inline-icon renderer only
// knows line-art prims). Value carried = the tech-icon id.
export const TECH_ICON_DND_MIME = 'application/x-livediagram-tech-icon';

export type TechProvider = 'aws' | 'azure' | 'generic';

export type TechIconDef = {
  id: string;
  label: string;
  // Optional shorter caption for the palette tile, where a long label
  // would truncate (and e.g. "Virtual Machine" / "Virtual Network" would
  // clip to the same ambiguous prefix). The full `label` is still used for
  // search, the aria-label, and the on-canvas element. Omit when `label`
  // already fits.
  short?: string;
  provider: TechProvider;
  // Extra search terms beyond the label (so "object storage" finds S3).
  keywords: string;
  // Tile fill — the service / brand colour.
  color: string;
  // Inner SVG markup in a 0..24 art box, drawn on top of the tile. The
  // renderer wraps it in a white line-art group, so a bare <path>/<circle>
  // strokes white; a filled mark sets fill="#fff" stroke="none" itself.
  glyph: string;
};

// Provider display names for the palette filter + tooltips.
export const TECH_PROVIDERS: { id: TechProvider; label: string }[] = [
  { id: 'aws', label: 'AWS' },
  { id: 'azure', label: 'Azure' },
  { id: 'generic', label: 'Generic' },
];

export const TECH_ICON_CATALOG: TechIconDef[] = [
  // ---- AWS ----------------------------------------------------------------
  {
    id: 'aws-s3',
    label: 'S3',
    provider: 'aws',
    keywords: 'amazon storage bucket object',
    color: '#7AA116',
    glyph:
      '<path d="M6.5 8h11l-1 9.2a1.3 1.3 0 0 1-1.3 1.15H8.8A1.3 1.3 0 0 1 7.5 17.2Z"/><path d="M6 8h12"/>',
  },
  {
    id: 'aws-ec2',
    label: 'EC2',
    provider: 'aws',
    keywords: 'amazon compute instance server virtual machine',
    color: '#ED7100',
    glyph:
      '<rect x="8" y="8" width="8" height="8" rx="1"/><path d="M10.5 8V5.5M13.5 8V5.5M10.5 16v2.5M13.5 16v2.5M8 10.5H5.5M8 13.5H5.5M16 10.5h2.5M16 13.5h2.5"/>',
  },
  {
    id: 'aws-lambda',
    label: 'Lambda',
    provider: 'aws',
    keywords: 'amazon serverless function compute',
    color: '#ED7100',
    glyph: '<path d="M8 17.8 12.4 6.4M11 9.3 16 17.8"/>',
  },
  {
    id: 'aws-rds',
    label: 'RDS',
    provider: 'aws',
    keywords: 'amazon relational database sql postgres mysql',
    color: '#3B48CC',
    glyph: '<ellipse cx="12" cy="8" rx="5" ry="2"/><path d="M7 8v8c0 1.1 2.2 2 5 2s5-.9 5-2V8"/>',
  },
  {
    id: 'aws-dynamodb',
    label: 'DynamoDB',
    provider: 'aws',
    keywords: 'amazon nosql database key value',
    color: '#3B48CC',
    glyph:
      '<ellipse cx="12" cy="8" rx="5" ry="2"/><path d="M7 8v8c0 1.1 2.2 2 5 2s5-.9 5-2V8"/><path d="M12.6 10.5l-2 3h1.6l-.6 2.4 2.4-3.2h-1.6l.6-2.2z" fill="#fff" stroke="none"/>',
  },
  {
    id: 'aws-apigateway',
    label: 'API Gateway',
    provider: 'aws',
    keywords: 'amazon api rest endpoint gateway',
    color: '#8C4FFF',
    glyph: '<path d="M9 8 5.5 12 9 16M15 8 18.5 12 15 16M13.2 7 10.8 17"/>',
  },
  {
    id: 'aws-cloudfront',
    label: 'CloudFront',
    provider: 'aws',
    keywords: 'amazon cdn content delivery edge',
    color: '#8C4FFF',
    glyph:
      '<circle cx="12" cy="12" r="5.5"/><path d="M6.5 12h11M12 6.5v11M8.4 8.4c2 1.4 5.2 1.4 7.2 0M8.4 15.6c2-1.4 5.2-1.4 7.2 0"/>',
  },
  {
    id: 'aws-route53',
    label: 'Route 53',
    provider: 'aws',
    keywords: 'amazon dns domain routing',
    color: '#8C4FFF',
    glyph:
      '<circle cx="12" cy="12" r="5.5"/><path d="M6.5 12h11M12 6.5c2.6 2.9 2.6 8.1 0 11M12 6.5c-2.6 2.9-2.6 8.1 0 11"/>',
  },
  {
    id: 'aws-vpc',
    label: 'VPC',
    provider: 'aws',
    keywords: 'amazon virtual private cloud network',
    color: '#8C4FFF',
    glyph:
      '<path d="M12 5 18 8.5v7L12 19 6 15.5v-7Z"/><circle cx="12" cy="12" r="2" fill="#fff" stroke="none"/>',
  },
  {
    id: 'aws-sqs',
    label: 'SQS',
    provider: 'aws',
    keywords: 'amazon queue message simple',
    color: '#E7157B',
    glyph:
      '<rect x="5.5" y="9" width="4.5" height="6" rx="1"/><rect x="14" y="9" width="4.5" height="6" rx="1"/><path d="M10.5 12h3"/>',
  },
  {
    id: 'aws-sns',
    label: 'SNS',
    provider: 'aws',
    keywords: 'amazon notification pub sub topic fanout',
    color: '#E7157B',
    glyph:
      '<circle cx="7.5" cy="12" r="1.8" fill="#fff" stroke="none"/><circle cx="16.5" cy="7.5" r="1.6" fill="#fff" stroke="none"/><circle cx="16.5" cy="12" r="1.6" fill="#fff" stroke="none"/><circle cx="16.5" cy="16.5" r="1.6" fill="#fff" stroke="none"/><path d="M9.2 11 14.9 7.9M9.3 12h5.6M9.2 13 14.9 16.1"/>',
  },
  {
    id: 'aws-ecs',
    label: 'ECS',
    provider: 'aws',
    keywords: 'amazon container elastic service docker',
    color: '#ED7100',
    glyph:
      '<rect x="6" y="6.5" width="5" height="5" rx=".8"/><rect x="13" y="6.5" width="5" height="5" rx=".8"/><rect x="9.5" y="12.8" width="5" height="5" rx=".8"/>',
  },
  {
    id: 'aws-eks',
    label: 'EKS',
    provider: 'aws',
    keywords: 'amazon kubernetes container k8s',
    color: '#ED7100',
    glyph:
      '<path d="M12 5 18 8.5v7L12 19 6 15.5v-7Z"/><path d="M12 9.2v5.6M9.5 14.4 12 9.2l2.5 5.2M9.3 13.6h5.4"/>',
  },
  {
    id: 'aws-cloudwatch',
    label: 'CloudWatch',
    provider: 'aws',
    keywords: 'amazon monitoring metrics observability gauge',
    color: '#E7157B',
    glyph:
      '<circle cx="12" cy="12" r="5.5"/><path d="M12 12 15 9.4"/><circle cx="12" cy="12" r="1" fill="#fff" stroke="none"/>',
  },
  {
    id: 'aws-iam',
    label: 'IAM',
    provider: 'aws',
    keywords: 'amazon identity access management security lock',
    color: '#DD344C',
    glyph:
      '<rect x="7.5" y="11" width="9" height="7" rx="1.2"/><path d="M9.5 11V9a2.5 2.5 0 0 1 5 0v2"/>',
  },
  // ---- Azure --------------------------------------------------------------
  {
    id: 'azure-vm',
    label: 'Virtual Machine',
    short: 'VM',
    provider: 'azure',
    keywords: 'microsoft compute server vm instance',
    color: '#0078D4',
    glyph: '<rect x="6" y="7" width="12" height="8" rx="1"/><path d="M9.5 18h5M12 15v3"/>',
  },
  {
    id: 'azure-blob',
    label: 'Blob Storage',
    short: 'Blob',
    provider: 'azure',
    keywords: 'microsoft storage object container',
    color: '#0078D4',
    glyph:
      '<rect x="6.8" y="6.8" width="4.5" height="4.5" rx=".6"/><rect x="12.7" y="6.8" width="4.5" height="4.5" rx=".6"/><rect x="9.7" y="12.7" width="4.5" height="4.5" rx=".6"/>',
  },
  {
    id: 'azure-appservice',
    label: 'App Service',
    provider: 'azure',
    keywords: 'microsoft web app hosting site',
    color: '#0078D4',
    glyph: '<circle cx="12" cy="12" r="5.5"/><path d="M6.5 12h11M12 6.5v11"/>',
  },
  {
    id: 'azure-functions',
    label: 'Functions',
    provider: 'azure',
    keywords: 'microsoft serverless function lightning',
    color: '#0062AD',
    glyph: '<path d="M13 5 8 13h3.2L10.5 19 16 10.5h-3.4Z" fill="#fff" stroke="none"/>',
  },
  {
    id: 'azure-sql',
    label: 'SQL Database',
    short: 'SQL DB',
    provider: 'azure',
    keywords: 'microsoft database relational sql',
    color: '#0078D4',
    glyph: '<ellipse cx="12" cy="8" rx="5" ry="2"/><path d="M7 8v8c0 1.1 2.2 2 5 2s5-.9 5-2V8"/>',
  },
  {
    id: 'azure-cosmosdb',
    label: 'Cosmos DB',
    provider: 'azure',
    keywords: 'microsoft nosql database global distributed',
    color: '#773ADC',
    glyph:
      '<ellipse cx="12" cy="12" rx="6" ry="2.6"/><ellipse cx="12" cy="12" rx="6" ry="2.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="6" ry="2.6" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.6" fill="#fff" stroke="none"/>',
  },
  {
    id: 'azure-aks',
    label: 'AKS',
    provider: 'azure',
    keywords: 'microsoft kubernetes container k8s service',
    color: '#0078D4',
    glyph:
      '<path d="M12 5 18 8.5v7L12 19 6 15.5v-7Z"/><path d="M12 9.2v5.6M9.5 14.4 12 9.2l2.5 5.2M9.3 13.6h5.4"/>',
  },
  {
    id: 'azure-vnet',
    label: 'Virtual Network',
    short: 'VNet',
    provider: 'azure',
    keywords: 'microsoft network vnet subnet',
    color: '#0078D4',
    glyph:
      '<circle cx="12" cy="7" r="1.9"/><circle cx="7" cy="16" r="1.9"/><circle cx="17" cy="16" r="1.9"/><path d="M11 8.6 8 14.4M13 8.6 16 14.4M9 16h6"/>',
  },
  {
    id: 'azure-loadbalancer',
    label: 'Load Balancer',
    short: 'Load Bal.',
    provider: 'azure',
    keywords: 'microsoft load balancer distribute traffic',
    color: '#0078D4',
    glyph:
      '<circle cx="12" cy="6" r="1.6" fill="#fff" stroke="none"/><circle cx="7" cy="17" r="1.6" fill="#fff" stroke="none"/><circle cx="12" cy="17" r="1.6" fill="#fff" stroke="none"/><circle cx="17" cy="17" r="1.6" fill="#fff" stroke="none"/><path d="M12 7.6v3.4M12 11H7v4.4M12 11v4.4M12 11h5v4.4"/>',
  },
  {
    id: 'azure-servicebus',
    label: 'Service Bus',
    provider: 'azure',
    keywords: 'microsoft message queue bus topic',
    color: '#0078D4',
    glyph:
      '<rect x="5.5" y="9" width="4.5" height="6" rx="1"/><rect x="14" y="9" width="4.5" height="6" rx="1"/><path d="M10.5 12h3"/>',
  },
  {
    id: 'azure-keyvault',
    label: 'Key Vault',
    provider: 'azure',
    keywords: 'microsoft secret key vault security',
    color: '#0062AD',
    glyph:
      '<circle cx="9.8" cy="11" r="3"/><path d="M12.1 12.6 17 17.5M15.2 15.1l-1.4 1.4M13.4 13.3 12 14.7"/>',
  },
  {
    id: 'azure-monitor',
    label: 'Monitor',
    provider: 'azure',
    keywords: 'microsoft monitoring metrics observability pulse',
    color: '#0078D4',
    glyph: '<circle cx="12" cy="12" r="5.5"/><path d="M9 12.5 11 9.8l1.6 4.2 1.2-2h1.7"/>',
  },
  // ---- Generic infrastructure --------------------------------------------
  {
    id: 'k8s',
    label: 'Kubernetes',
    provider: 'generic',
    keywords: 'k8s container orchestration helm cluster',
    color: '#326CE5',
    glyph:
      '<path d="M12 4.8 17.6 7.4 19 13 15.2 17.6H8.8L5 13 6.4 7.4Z"/><circle cx="12" cy="12" r="1.4" fill="#fff" stroke="none"/><path d="M12 7.2v3.2M15.4 9.6 13 11M14.2 15.4 12.6 13M9.8 15.4 11.4 13M8.6 9.6 11 11"/>',
  },
  {
    id: 'docker',
    label: 'Docker',
    provider: 'generic',
    keywords: 'container image whale compose',
    color: '#2496ED',
    glyph:
      '<g fill="#fff" stroke="none"><rect x="6" y="11.2" width="2.4" height="2.4"/><rect x="8.9" y="11.2" width="2.4" height="2.4"/><rect x="11.8" y="11.2" width="2.4" height="2.4"/><rect x="8.9" y="8.3" width="2.4" height="2.4"/><rect x="11.8" y="8.3" width="2.4" height="2.4"/></g><path d="M5 14.2h11.5c.4 1.8-1.4 4-4.7 4-3.8 0-5.5-2-6.8-4Z" fill="#fff" stroke="none"/>',
  },
  {
    id: 'postgres',
    label: 'PostgreSQL',
    provider: 'generic',
    keywords: 'postgres database relational sql elephant',
    color: '#336791',
    glyph:
      '<ellipse cx="12" cy="8" rx="5" ry="2"/><path d="M7 8v8c0 1.1 2.2 2 5 2s5-.9 5-2V8"/><path d="M7 12c0 1.1 2.2 2 5 2s5-.9 5-2"/>',
  },
  {
    id: 'mysql',
    label: 'MySQL',
    provider: 'generic',
    keywords: 'database relational sql dolphin',
    color: '#00758F',
    glyph:
      '<ellipse cx="12" cy="8" rx="5" ry="2"/><path d="M7 8v8c0 1.1 2.2 2 5 2s5-.9 5-2V8"/><path d="M7 12c0 1.1 2.2 2 5 2s5-.9 5-2"/>',
  },
  {
    id: 'redis',
    label: 'Redis',
    provider: 'generic',
    keywords: 'cache key value in-memory store',
    color: '#FF4438',
    glyph:
      '<path d="M12 5 19 8.3 12 11.6 5 8.3Z"/><path d="M5 11.8 12 15.1l7-3.3M5 15.1 12 18.4l7-3.3"/>',
  },
  {
    id: 'mongodb',
    label: 'MongoDB',
    provider: 'generic',
    keywords: 'database nosql document leaf',
    color: '#47A248',
    glyph:
      '<path d="M12 5c2.6 3 4 5.6 4 8 0 3-2 5.1-4 6-2-.9-4-3-4-6 0-2.4 1.4-5 4-8Z" fill="#fff" stroke="none"/>',
  },
  {
    id: 'kafka',
    label: 'Kafka',
    provider: 'generic',
    keywords: 'apache stream event broker message',
    color: '#231F20',
    glyph:
      '<circle cx="8.5" cy="8" r="1.8"/><circle cx="8.5" cy="16" r="1.8"/><circle cx="16" cy="12" r="2"/><path d="M10 8.8 14.3 11M10 15.2 14.3 13"/>',
  },
  {
    id: 'nginx',
    label: 'Nginx',
    provider: 'generic',
    keywords: 'web server reverse proxy load balancer',
    color: '#009639',
    glyph: '<path d="M8 17.5V7.5l8 9v-9" stroke-width="1.8"/>',
  },
  {
    id: 'rabbitmq',
    label: 'RabbitMQ',
    provider: 'generic',
    keywords: 'message queue broker amqp',
    color: '#FF6600',
    glyph:
      '<path d="M9 6.5v4M11.5 6.5v4"/><path d="M8 10.5h8v6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1Z" fill="#fff" stroke="none"/><rect x="12.5" y="12.5" width="2.5" height="2.5" rx=".3" fill="#FF6600" stroke="none"/>',
  },
  {
    id: 'elasticsearch',
    label: 'Elasticsearch',
    short: 'Elastic',
    provider: 'generic',
    keywords: 'search index lucene elk log',
    color: '#00BFB3',
    glyph: '<path d="M6.5 8.5h11M6.5 12h8.5M6.5 15.5h6" stroke-width="1.8"/>',
  },
  {
    id: 'graphql',
    label: 'GraphQL',
    provider: 'generic',
    keywords: 'api query schema',
    color: '#E10098',
    glyph:
      '<path d="M12 5.5 17.6 8.7v6.6L12 18.5 6.4 15.3V8.7Z"/><g fill="#fff" stroke="none"><circle cx="12" cy="5.5" r="1.3"/><circle cx="17.6" cy="8.7" r="1.3"/><circle cx="17.6" cy="15.3" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/><circle cx="6.4" cy="15.3" r="1.3"/><circle cx="6.4" cy="8.7" r="1.3"/></g>',
  },
];

const TECH_ICON_BY_ID = new Map(TECH_ICON_CATALOG.map((i) => [i.id, i]));

// True when the id resolves in this catalogue — the render path uses it to
// pick the coloured brand renderer over the line-art one.
export function isTechIconId(id: string | undefined): boolean {
  return !!id && TECH_ICON_BY_ID.has(id);
}

export function getTechIcon(id: string | undefined): TechIconDef | undefined {
  return id ? TECH_ICON_BY_ID.get(id) : undefined;
}

// Case-insensitive search over label + keywords + id, optionally narrowed
// to one provider. Empty query returns the (filtered) catalogue.
export function searchTechIcons(query: string, provider: TechProvider | 'all'): TechIconDef[] {
  const base =
    provider === 'all'
      ? TECH_ICON_CATALOG
      : TECH_ICON_CATALOG.filter((i) => i.provider === provider);
  const q = query.trim().toLowerCase();
  if (!q) return base;
  return base.filter(
    (i) =>
      i.label.toLowerCase().includes(q) ||
      i.keywords.includes(q) ||
      i.id.includes(q) ||
      i.provider.includes(q),
  );
}
