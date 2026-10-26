// docs/specs/014-identity/transactional-email.md: the email client. Mail goes out through Cloudflare Email Service's
// `EMAIL` binding, by way of @liveworkspace/email (liveworkspace/docs/specs/003-accounts/email.md). The whole email feature is gated on
// that binding: without it, every send is a no-op, so a deployment with email off does zero extra work. Sends are
// best-effort: this never throws, so an email or network failure can't fail or delay the request that triggered it
// (callers run sends inside ctx.waitUntil or the daily cron).

import { redactAddress, sendEmail as sendThroughBinding } from '@liveworkspace/email';
import type { Env } from '../types';
import { reportServerEvent } from '../server-telemetry';
import type { EmailKind } from './templates';

const DEFAULT_FROM = 'liveplanner <hello@liveplanner.app>';
const DEFAULT_BASE_URL = 'https://www.liveplanner.app';

export function emailEnabled(env: Env): boolean {
  return env.EMAIL !== undefined;
}

// Public origin for links in emails. Trailing slashes stripped so callers can
// always template `${appBaseUrl(env)}/path`.
export function appBaseUrl(env: Env): string {
  const base = env.APP_BASE_URL ?? DEFAULT_BASE_URL;
  // A reverse scan rather than /\/+$/. That pattern is unanchored, so on a
  // value that does not end in a slash the engine retries from every offset,
  // which is quadratic in the length. This one only ever sees a configured env
  // var, but a linear strip costs nothing and stops the shape being copied.
  let end = base.length;
  while (end > 0 && base.charCodeAt(end - 1) === SLASH) end -= 1;
  return base.slice(0, end);
}

const SLASH = '/'.charCodeAt(0);

type EmailMessage = {
  // Which template this is, for the docs/specs/017-telemetry/telemetry.md 'Email' telemetry below. Comes
  // from the builder's own return, so callers never spell it out.
  kind: EmailKind;
  to: string;
  subject: string;
  html: string;
  // For opt-out emails: a URL where the recipient can manage / turn off this
  // category. Emitted as a `List-Unsubscribe` header so mail clients can surface
  // a native unsubscribe affordance (we point it at the profile page rather than
  // a one-click POST endpoint, by design — docs/specs/014-identity/transactional-email.md).
  unsubscribeUrl?: string;
};

// A send gives up after @liveworkspace/email's EMAIL_SEND_TIMEOUT_MS. Sends run in the daily email cron and in
// waitUntil after a response, so a hung call must not hold the cron batch behind it; a timed-out send is a failed
// send, logged like any other.
export async function sendEmail(env: Env, msg: EmailMessage): Promise<{ sent: boolean }> {
  if (!env.EMAIL) return { sent: false };
  // One anonymous telemetry row per outcome (docs/specs/017-telemetry/telemetry.md), written server-side
  // because nothing about an email reaches a browser: the send happens in a
  // cron or a waitUntil after the response has gone. Without it the notifications
  // (docs/specs/014-identity/transactional-email.md) were unmeasurable and a missing sender was invisible.
  // reportServerEvent gates on TELEMETRY_ENABLED and swallows its own failure.
  try {
    await sendThroughBinding(env.EMAIL, {
      from: env.EMAIL_FROM ?? DEFAULT_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      ...(msg.unsubscribeUrl && { unsubscribeUrl: msg.unsubscribeUrl }),
    });
  } catch (err) {
    // Email Service's refusal code (E_RECIPIENT_SUPPRESSED, ...) when it gave one; anything else (a timeout, a
    // thrown network error) counts as Network.
    const code = (err as { code?: unknown } | null)?.code;
    const kind = typeof code === 'string' && code ? code : 'Network';
    console.error(
      `[email] send failed (${kind}) subject="${msg.subject}" to=${redactAddress(msg.to)}`,
      err,
    );
    await reportServerEvent(env, 'Error', 'Api', `${kind}.SendEmail`);
    return { sent: false };
  }
  await reportServerEvent(env, 'Email', 'Sent', msg.kind);
  return { sent: true };
}
