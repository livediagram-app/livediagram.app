#!/usr/bin/env node
// Builds the site for the products' signed-in e2e specs, into `.next/out-e2e/` (never `out/`, so it can't be
// deployed by mistake). NEXT_PUBLIC_E2E_AUTH=1 makes the Explorer on an app's address read the session the specs
// put in localStorage (`<app>:e2e:session`, lib/explorer/app-session.ts e2eAccount), as the editor's signed-in build
// does, so the Explorer opens as the same signed-in person. The products' stacks serve it with
// E2E_WORKSPACE_SITE_OUT=.next/out-e2e.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Inside `.next/`, which every build ignore, lint, format and source scanner already skips.
const E2E_OUT = '.next/out-e2e';

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: SITE_DIR, stdio: 'inherit', env });
  if (result.status !== 0) {
    console.error(`[e2e] ${command} ${args.join(' ')} failed with exit ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`[e2e] building ${E2E_OUT}/ with the e2e session`);
run('node', ['lib/licences/generate.ts', '--out', '.']);
run('pnpm', ['exec', 'next', 'build'], {
  ...process.env,
  NEXT_PUBLIC_E2E_AUTH: '1',
  // A custom distDir makes Next write the static export there instead of `out/`.
  NEXT_DISTDIR: E2E_OUT,
});
run('node', ['scripts/asset-prefix.mjs', E2E_OUT]);
console.log(`[e2e] built ${E2E_OUT}/`);
