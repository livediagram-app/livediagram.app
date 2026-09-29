#!/usr/bin/env node
// Builds the live app with Clerk switched ON, into `out-clerk-stub/`, for the signed-in e2e
// specs (docs/specs/014-identity/blueprints/profile-picture.md). Clerk is a build-time switch
// (lib/clerk-config.ts), so the guest-mode `out/` cannot show a signed-in user at all.
//
// The publishable key is syntactically valid but names a host that cannot resolve
// (`clerk.stub.invalid`): the specs install a fake `window.Clerk` before the page loads, so
// @clerk/react never fetches anything from it. Not a secret; it opens nothing.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLERK_STUB_OUT = 'out-clerk-stub';
const STUB_KEY = `pk_test_${Buffer.from('clerk.stub.invalid$').toString('base64')}`;

console.log(`[clerk-stub] building ${CLERK_STUB_OUT}/ with Clerk on (stub key)`);
const child = spawn('pnpm', ['exec', 'next', 'build'], {
  cwd: APP_DIR,
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: STUB_KEY,
    // Same-origin `/api`, as the e2e stack proxies it, whatever .env.local says.
    NEXT_PUBLIC_API_BASE: '',
    // A custom distDir makes Next write the static export there instead of `out/`.
    NEXT_DISTDIR: CLERK_STUB_OUT,
  },
});
child.on('exit', (code) => {
  if (code === 0) console.log(`[clerk-stub] built ${CLERK_STUB_OUT}/`);
  else console.error(`[clerk-stub] build failed with exit ${code}`);
  process.exit(code ?? 1);
});
