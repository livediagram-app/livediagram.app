// MANUAL preview harness (docs/specs/014-identity/transactional-email.md). Renders one email per template and
// hands it to the real client, as the daily cron would, with a stand-in for the `send_email` binding that writes
// each message's HTML to a file instead of sending it, so you can eyeball them in a browser before turning email
// on for a deployment. Email Service sends only from inside a Worker (liveworkspace/docs/email.md), so a real
// send to an inbox is `wrangler dev` (which simulates the binding the same way) or a deployed staging Worker.
// Gated so it never runs during a normal test run / CI: it only runs when EMAIL_PREVIEW=1 is passed.
//
// Run it:
//   EMAIL_PREVIEW=1 pnpm --filter @liveplanner/api exec \
//     vitest run src/email/send-test-email.test.ts
//
// Optional, from apps/api/.dev.vars (gitignored) or the shell:
//   EMAIL_FROM=...      # defaults to the sender in wrangler.toml's [vars]
//   APP_BASE_URL=...    # where the links point

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { sendEmail } from './client';
import { type RenderedEmail, accountDeletedEmail, commentNotificationEmail } from './templates';

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
const ENABLED = nodeEnv.EMAIL_PREVIEW === '1';
const OUT = join(tmpdir(), 'liveplanner-email-preview');

// The binding as wrangler dev simulates it: nothing leaves the machine, each message lands in a file.
const previewBinding = {
  async send(message: { subject: string; html: string }) {
    mkdirSync(OUT, { recursive: true });
    const file = join(OUT, `${message.subject.replace(/[^\w-]+/g, '-').slice(0, 60)}.html`);
    writeFileSync(file, message.html);
    console.log(`[email-preview] ${message.subject}: ${file}`);
    return { messageId: file };
  },
};

const env = {
  EMAIL: previewBinding,
  EMAIL_FROM: vars.EMAIL_FROM ?? 'liveplanner <hello@liveplanner.app>',
  APP_BASE_URL: vars.APP_BASE_URL ?? 'https://liveplanner.app',
} as unknown as Env;

describe.skipIf(!ENABLED)('email preview (manual harness)', () => {
  const cases: Record<string, RenderedEmail> = {
    // Transactional (the onboarding series is the liveworkspace accounts Worker's)
    'account-deleted': accountDeletedEmail(env),
    // Opt-out notifications
    'comment-notification': commentNotificationEmail(env, 'Q3 Roadmap', 'diagram-id-123', 'Anna'),
  };
  for (const [name, msg] of Object.entries(cases)) {
    it(`renders ${name}`, async () => {
      const res = await sendEmail(env, { to: 'preview@example.com', ...msg });
      expect(res.sent).toBe(true);
    });
  }
});
