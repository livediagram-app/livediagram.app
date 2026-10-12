import { inTier, type PreviewApp, type PreviewTier } from './apps.ts';
import { PreviewError } from './errors.ts';
import {
  PREVIEW_ENV,
  d1Name,
  previewHost,
  previewOrigin,
  r2Name,
  stagingWorkerName,
  workerName,
  type PrNumber,
} from './names.ts';

// The preview config is generated from each app's `[env.staging]` block, the complete
// non-inheriting config for a non-production copy
// (docs/specs/016-platform/blueprints/pr-previews.md "Config rewrite").
export type Table = Record<string, unknown>;

export interface PreviewConfigInput {
  app: PreviewApp;
  pr: PrNumber;
  tier: PreviewTier;
  d1Id?: string;
}

// A key outside this list fails the preview until the rewrite says what to do with it.
export const KNOWN_ENV_KEYS = [
  'name',
  'vars',
  'services',
  'd1_databases',
  'r2_buckets',
  'kv_namespaces',
  'unsafe',
  'durable_objects',
  'migrations',
  'triggers',
  'assets',
  'routes',
] as const;

const STAGING_SERVICE = /^livediagram-([a-z]+)-staging$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isTable = (value: unknown): value is Table =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const tables = (value: unknown): Table[] => (Array.isArray(value) ? value.filter(isTable) : []);

export function previewConfig(source: Table, input: PreviewConfigInput): Table {
  const { app, pr, tier } = input;
  if (!inTier(app, tier)) {
    throw new PreviewError('not-in-tier', `${app} is not deployed by a ${tier} preview`);
  }
  const env = source.env;
  const staging = isTable(env) ? env.staging : undefined;
  if (!isTable(staging)) throw new PreviewError('no-staging-env', `${app} has no [env.staging]`);

  for (const key of Object.keys(staging)) {
    if (!(KNOWN_ENV_KEYS as readonly string[]).includes(key)) {
      throw new PreviewError('unknown-key', `${app} [env.staging] holds ${key}`);
    }
  }
  if (staging.name !== stagingWorkerName(app)) {
    throw new PreviewError('bad-name', `${app} [env.staging] name is ${String(staging.name)}`);
  }
  if ('routes' in staging) throw new PreviewError('has-routes', `${app} [env.staging] has routes`);
  if ('kv_namespaces' in staging) {
    throw new PreviewError('kv-in-preview', `${app} binds a KV namespace`);
  }

  const preview = structuredClone(staging);
  preview.name = workerName(app, pr);

  if ('services' in staging) {
    preview.services = tables(staging.services).map((binding) => {
      const target = STAGING_SERVICE.exec(String(binding.service))?.[1];
      if (target === undefined) {
        throw new PreviewError('bad-service', `${app} binds ${String(binding.service)}`);
      }
      return inTier(target, tier) ? { ...binding, service: workerName(target, pr) } : binding;
    });
  }

  const vars = isTable(preview.vars) ? preview.vars : {};
  if (app === 'router') {
    if (!('DEPLOY_ENV' in vars)) throw new PreviewError('missing-var', 'router lacks DEPLOY_ENV');
    vars.DEPLOY_ENV = PREVIEW_ENV;
    preview.routes = [{ pattern: previewHost(pr), custom_domain: true }];
  }
  if (app === 'api') rewriteApi(preview, vars, input);

  // `triggers` is inherited from the top level, so absent here means production's crons.
  if ('triggers' in staging || 'triggers' in source) preview.triggers = { crons: [] };

  const { env: _env, ...topLevel } = source;
  return { ...topLevel, env: { [PREVIEW_ENV]: preview } };
}

function rewriteApi(preview: Table, vars: Table, { pr, d1Id }: PreviewConfigInput): void {
  if (!('AI_ALLOWED_ORIGINS' in vars)) {
    throw new PreviewError('missing-var', 'api lacks AI_ALLOWED_ORIGINS');
  }
  vars.AI_ALLOWED_ORIGINS = previewOrigin(pr);

  const d1 = tables(preview.d1_databases);
  if (d1.length !== 1 || d1[0]?.binding !== 'DB') {
    throw new PreviewError('bad-d1', 'api must bind exactly one D1, DB');
  }
  if (d1Id === undefined || !UUID.test(d1Id)) {
    throw new PreviewError('bad-d1', `api needs the PR's D1 id, got ${String(d1Id)}`);
  }
  preview.d1_databases = [{ ...d1[0], database_name: d1Name(pr), database_id: d1Id }];

  const r2 = tables(preview.r2_buckets);
  if (r2.length !== 1 || r2[0]?.binding !== 'IMAGES') {
    throw new PreviewError('bad-r2', 'api must bind exactly one R2 bucket, IMAGES');
  }
  preview.r2_buckets = [{ ...r2[0], bucket_name: r2Name(pr) }];
}
