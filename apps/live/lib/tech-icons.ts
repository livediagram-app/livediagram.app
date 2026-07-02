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
//
// This module is the SYNCHRONOUS API surface only. The heavy per-icon data
// (colour + SVG markup) lives in tech-icons-data.ts and loads as an async
// chunk through lib/icon-registry.ts, keeping ~25 kB out of the editor's
// first-load JS. Nothing here may import the data module statically.

import { getLoadedTechIconCatalog, getTechIconLoaded } from './icon-registry';

// Drag-from-palette MIME for a Technology tile dropped on the canvas.
// Distinct from ICON_DND_MIME so the tile creates a STANDALONE icon
// element and is ignored by the shape drop-target (a coloured brand tile
// beside a shape's text is meaningless, and the inline-icon renderer only
// knows line-art prims). Value carried = the tech-icon id.
export const TECH_ICON_DND_MIME = 'application/x-livediagram-tech-icon';

export type TechProvider = 'aws' | 'azure' | 'cloudflare' | 'firebase' | 'generic';

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
  { id: 'cloudflare', label: 'Cloudflare' },
  { id: 'firebase', label: 'Firebase' },
  { id: 'generic', label: 'Generic' },
];

// Every tech-icon id, kept HERE (first-load) while the full defs live in the
// async tech-icons-data.ts chunk. `isTechIconId` gates real-time paths that
// cannot wait for that chunk — the render dispatch (coloured vs line-art), the
// drag fold-into-shape exclusion, the draw-commit telemetry — and tech ids
// carry no common prefix ('aws-*' but also bare 'k8s' / 'docker'), so a cheap
// prefix test can't replace a membership check. ~68 short strings ≈ 1 kB: an
// acceptable first-load cost for keeping those answers exact from the first
// frame. A parity test (tech-icons.test.ts) pins this set to the data
// catalogue's ids, so adding an icon without registering its id here fails CI
// rather than silently rendering as the line-art placeholder.
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

// True when the id resolves in this catalogue — the render path uses it to
// pick the coloured brand renderer over the line-art one. Answered from the
// lightweight id set above (NOT the async data), so drag / draw / render
// dispatch is exact even before the catalogue chunk arrives.
export function isTechIconId(id: string | undefined): boolean {
  return !!id && TECH_ICON_IDS.has(id);
}

// Resolves the full definition (colour + glyph markup). Returns undefined for
// an unknown id AND until the async catalogue chunk has loaded — check
// `isTechIconId` to tell "not a tech icon" from "data still in flight"
// (tech-icon-glyph.tsx uses exactly that split to paint a skeleton tile).
export function getTechIcon(id: string | undefined): TechIconDef | undefined {
  return getTechIconLoaded(id);
}

// Case-insensitive search over label + keywords + id, optionally narrowed
// to one provider. Empty query returns the (filtered) catalogue. Empty
// result set until the catalogue chunk loads — the picker subscribes via
// useIconCatalogs and re-runs the search when the data lands.
export function searchTechIcons(query: string, provider: TechProvider | 'all'): TechIconDef[] {
  const catalog = getLoadedTechIconCatalog();
  const base = provider === 'all' ? catalog : catalog.filter((i) => i.provider === provider);
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
