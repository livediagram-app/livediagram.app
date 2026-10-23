// MANUAL live-send harness (docs/specs/014-identity/transactional-email.md). Sends one REAL email per template via the
// real client, so you can eyeball them in an inbox before enabling email on a
// deployment. Double-gated so it can never fire during a normal test run / CI:
// it only runs when RESEND_LIVE_TEST=1 is passed AND RESEND_API_KEY +
// RESEND_TEST_TO are present (read from apps/api/.dev.vars, gitignored).
//
// Run it:
//   RESEND_LIVE_TEST=1 pnpm --filter @livediagram/api exec \
//     vitest run src/email/send-test-email.test.ts
//
// .dev.vars needs:
//   RESEND_API_KEY=re_...
//   RESEND_TEST_TO=you@example.com   # for an UNVERIFIED Resend domain this
//                                    # must be your Resend account email
//   RESEND_FROM=...                  # optional; defaults to onboarding@resend.dev
//                                    # (the sender that works without a verified domain)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { sendEmail } from './client';
import {
  type RenderedEmail,
  accountDeletedEmail,
  commentNotificationEmail,
  documentJoinedEmail,
  firstShareEmail,
  milestoneEmail,
  tokenExpiringEmail,
} from './templates';

function devVars(): Record<string, string> {
  try {
    const txt = readFileSync(
      fileURLToPath(new URL('../../.dev.vars', import.meta.url).href),
      'utf8',
    );
    const out: Record<string, string> = {};
    for (const line of txt.split('\n')) {
      if (line.trim().startsWith('#')) continue;
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]!] = m[2]!.trim();
    }
    return out;
  } catch {
    return {};
  }
}

// Node's environment. The Workers types this package compiles with leave `process` untyped.
const nodeEnv = (process as { env: Record<string, string | undefined> }).env;
const vars: Record<string, string | undefined> = { ...devVars(), ...nodeEnv };
const TO = vars.RESEND_TEST_TO;
const KEY = vars.RESEND_API_KEY;
const ENABLED = nodeEnv.RESEND_LIVE_TEST === '1' && !!TO && !!KEY;

const env = {
  RESEND_API_KEY: KEY,
  RESEND_FROM: vars.RESEND_FROM ?? 'livediagram <onboarding@resend.dev>',
  APP_BASE_URL: vars.APP_BASE_URL ?? 'https://livediagram.app',
} as unknown as Env;

describe.skipIf(!ENABLED)('live email send (manual harness)', () => {
  const cases: Record<string, RenderedEmail> = {
    // Milestones (the onboarding series is liveworkspace's)
    milestone: milestoneEmail(env, 10),
    'first-share': firstShareEmail(env),
    // Transactional
    'account-deleted': accountDeletedEmail(env),
    'token-expiry': tokenExpiringEmail(env, 'CI deploy token', Date.UTC(2026, 0, 5)),
    // Opt-out notifications
    'comment-notification': commentNotificationEmail(env, 'Q3 Roadmap', 'diagram-id-123', 'Anna'),
    'document-joined': documentJoinedEmail(env, 'Q3 Roadmap', 'Anna'),
  };
  for (const [name, msg] of Object.entries(cases)) {
    it(`sends ${name} to ${TO}`, async () => {
      const res = await sendEmail(env, { to: TO!, ...msg });
      console.log(`[send-test] ${name}: ${JSON.stringify(res)}`);
      expect(res.sent).toBe(true);
    });
  }
});
