// MANUAL preview harness (docs/specs/014-identity/transactional-email.md). Renders one email per template
// through the real client, so you can eyeball them in a browser before enabling email on a deployment. Email
// Service's `send_email` binding only exists inside a Worker, so this stands one in that writes each message's
// HTML to apps/api/.wrangler/email-preview/<name>.html (gitignored) instead of sending it, much as `wrangler dev`
// simulates the binding. A real inbox needs a deployed Worker with the binding. Gated so it can never fire
// during a normal test run / CI: it only runs when EMAIL_PREVIEW=1 is passed.
//
// Run it:
//   EMAIL_PREVIEW=1 pnpm --filter @livedesign/api exec \
//     vitest run src/email/send-test-email.test.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { sendEmail } from './client';
import {
  type RenderedEmail,
  accountDeletedEmail,
  commentNotificationEmail,
  designJoinedEmail,
  firstShareEmail,
  milestoneEmail,
} from './templates';

// Node's environment. The Workers types this package compiles with leave `process` untyped.
const nodeEnv = (process as { env: Record<string, string | undefined> }).env;
const ENABLED = nodeEnv.EMAIL_PREVIEW === '1';
const OUT = fileURLToPath(new URL('../../.wrangler/email-preview/', import.meta.url).href);
const TO = 'you@example.com';

let current = '';
const env = {
  // Writes the message the binding would have sent, under the name of the case being rendered.
  EMAIL: {
    send: async (message: { subject: string; html: string }) => {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}${current}.html`, message.html);
      return { messageId: current };
    },
  },
  APP_BASE_URL: nodeEnv.APP_BASE_URL ?? 'https://livedesign.app',
} as unknown as Env;

describe.skipIf(!ENABLED)('email preview (manual harness)', () => {
  const cases: Record<string, RenderedEmail> = {
    // Milestones (the onboarding series is liveworkspace's, sent by its accounts Worker)
    milestone: milestoneEmail(env, 10),
    'first-share': firstShareEmail(env),
    // Transactional
    'account-deleted': accountDeletedEmail(env),
    // Opt-out notifications
    'comment-notification': commentNotificationEmail(env, 'Q3 Roadmap', 'diagram-id-123', 'Anna'),
    'design-joined': designJoinedEmail(env, 'Q3 Roadmap', 'Anna'),
  };
  for (const [name, msg] of Object.entries(cases)) {
    it(`renders ${name}`, async () => {
      current = name;
      const res = await sendEmail(env, { to: TO, ...msg });
      console.log(`[email-preview] ${name}: ${OUT}${name}.html`);
      expect(res.sent).toBe(true);
    });
  }
});
