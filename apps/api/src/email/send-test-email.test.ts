// MANUAL live-send harness (spec/64). Sends one REAL email per template via the
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
import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { sendEmail } from './client';
import {
  accountDeletedEmail,
  activationEmail,
  commentNotificationEmail,
  diagramJoinedEmail,
  firstShareEmail,
  inviteResponseEmail,
  milestoneEmail,
  teamInviteEmail,
  tokenExpiringEmail,
  week1Email,
  week2Email,
  welcomeEmail,
  winBackEmail,
} from './templates';

function devVars(): Record<string, string> {
  try {
    const txt = readFileSync(new URL('../../.dev.vars', import.meta.url), 'utf8');
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

const vars = { ...devVars(), ...process.env } as Record<string, string | undefined>;
const TO = vars.RESEND_TEST_TO;
const KEY = vars.RESEND_API_KEY;
const ENABLED = process.env.RESEND_LIVE_TEST === '1' && !!TO && !!KEY;

const env = {
  RESEND_API_KEY: KEY,
  RESEND_FROM: vars.RESEND_FROM ?? 'livediagram <onboarding@resend.dev>',
  APP_BASE_URL: vars.APP_BASE_URL ?? 'https://livediagram.app',
} as unknown as Env;

describe.skipIf(!ENABLED)('live email send (manual harness)', () => {
  const cases: Record<string, { subject: string; html: string }> = {
    // Onboarding series
    welcome: welcomeEmail(env),
    'week1-explorer': week1Email(env),
    'week2-teams': week2Email(env),
    activation: activationEmail(env),
    'win-back': winBackEmail(env),
    milestone: milestoneEmail(env, 10),
    'first-share': firstShareEmail(env),
    // Transactional
    'team-invite': teamInviteEmail(env, 'Acme Inc'),
    'account-deleted': accountDeletedEmail(env),
    'token-expiry': tokenExpiringEmail(env, 'CI deploy token', Date.UTC(2026, 0, 5)),
    // Opt-out notifications
    'comment-notification': commentNotificationEmail(env, 'Q3 Roadmap', 'diagram-id-123', 'Anna'),
    'diagram-joined': diagramJoinedEmail(env, 'Q3 Roadmap', 'Anna'),
    'invite-accepted': inviteResponseEmail(env, 'Acme Inc', 'sam@example.com', true),
    'invite-declined': inviteResponseEmail(env, 'Acme Inc', 'sam@example.com', false),
  };
  for (const [name, msg] of Object.entries(cases)) {
    it(`sends ${name} to ${TO}`, async () => {
      const res = await sendEmail(env, { to: TO!, ...msg });
      // eslint-disable-next-line no-console
      console.log(`[send-test] ${name}: ${JSON.stringify(res)}`);
      expect(res.sent).toBe(true);
    });
  }
});
