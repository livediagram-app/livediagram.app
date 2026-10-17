// Proves every generated preview config still deploys: `wrangler deploy --dry-run` on the
// apps whose bindings the generator rewrites, in both tiers. Runs as this package's
// `staging:check`, so CI's existing staging config step covers previews too
// (docs/specs/016-platform/blueprints/pr-previews.md "Testing").

import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { TIER_APPS, type PreviewTier } from '../src/apps.ts';
import { PREVIEW_CONFIG_FILE, PREVIEW_ENV, parsePrNumber } from '../src/names.ts';
import { appDir, writePreviewConfig } from './config.ts';

// The sites (community included) need a build in ./out to dry-run; config.test.ts pins their bindings.
const CHECKED = ['api', 'router'] as const;
const PR = parsePrNumber(999_999);
const D1_ID = '00000000-0000-4000-8000-000000000000';
// The repo root's, which `pnpm exec wrangler` resolves to in an app without its own.
const WRANGLER = fileURLToPath(new URL('../../../node_modules/.bin/wrangler', import.meta.url));

for (const tier of ['preview', 'full'] as PreviewTier[]) {
  for (const app of CHECKED.filter((a) => TIER_APPS[tier].includes(a))) {
    const path = writePreviewConfig(app, PR, tier, app === 'api' ? D1_ID : undefined);
    try {
      execFileSync(
        WRANGLER,
        ['deploy', '--dry-run', '--config', PREVIEW_CONFIG_FILE, '--env', PREVIEW_ENV],
        { cwd: appDir(app), stdio: ['ignore', 'ignore', 'inherit'] },
      );
      console.log(`[preview] check app=${app} tier=${tier} ok`);
    } finally {
      rmSync(path, { force: true });
    }
  }
}
