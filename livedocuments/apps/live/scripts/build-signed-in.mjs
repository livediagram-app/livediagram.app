#!/usr/bin/env node
// Builds the live app with sign-in switched ON, into `.next/out-signed-in/`, for the signed-in e2e
// specs (docs/specs/003-system-architecture/e2e-smoke.md "Signed-in specs"). Sign-in is a build-time
// switch (lib/auth-config.ts), so the guest-mode `out/` cannot show a signed-in user at all.
//
// NEXT_PUBLIC_E2E_AUTH=1 swaps the accounts bridge for the test-only E2EAuthBridge, which takes the
// session the spec put in localStorage (e2e/signed-in/session.ts), so nothing here talks to the
// liveworkspace accounts Worker.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Inside `.next/`, which every build ignore, lint, format and source scanner already skips.
const SIGNED_IN_OUT = '.next/out-signed-in';

console.log(`[signed-in] building ${SIGNED_IN_OUT}/ with sign-in on (e2e auth bridge)`);
const child = spawn('pnpm', ['exec', 'next', 'build'], {
  cwd: APP_DIR,
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SIGN_IN_ENABLED: 'true',
    NEXT_PUBLIC_E2E_AUTH: '1',
    // Same-origin `/api`, as the e2e stack proxies it, whatever .env.local says. Spelled out: an
    // empty value is not "unset" (API_BASE falls back only on undefined), and would drop the /api.
    NEXT_PUBLIC_API_BASE: '/api',
    // A custom distDir makes Next write the static export there instead of `out/`.
    NEXT_DISTDIR: SIGNED_IN_OUT,
  },
});
child.on('exit', (code) => {
  if (code === 0) console.log(`[signed-in] built ${SIGNED_IN_OUT}/`);
  else console.error(`[signed-in] build failed with exit ${code}`);
  process.exit(code ?? 1);
});
