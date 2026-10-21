// docs/specs/014-identity/transactional-email.md: Resend client. The whole email feature is gated on RESEND_API_KEY:
// absent, every send is a no-op and the lifecycle table is never touched, so a
// deployment with email off does zero extra work (mirrors the OPENAI_API_KEY ->
// AI-hidden pattern). Sends are best-effort: this never throws, so an email or
// network failure can't fail or delay the request that triggered it (callers
// run sends inside ctx.waitUntil or the daily cron).

import type { Env } from '../types';
import { reportServerEvent } from '../server-telemetry';
import type { EmailKind } from './templates';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'liveplanner <hello@liveplanner.app>';
const DEFAULT_BASE_URL = 'https://liveplanner.app';

export function emailEnabled(env: Env): boolean {
  return typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.length > 0;
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

// The longest a send may wait on Resend, which answers in well under a second. Sends run in the daily
// email cron and in waitUntil after a response: a hung call held the whole cron batch behind it.
// A timed-out send is a failed send, logged like any other. Safe range: 3 s to 30 s.
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

export async function sendEmail(env: Env, msg: EmailMessage): Promise<{ sent: boolean }> {
  if (!emailEnabled(env)) return { sent: false };
  try {
    const headers: Record<string, string> = msg.unsubscribeUrl
      ? { 'List-Unsubscribe': `<${msg.unsubscribeUrl}>` }
      : {};
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM ?? DEFAULT_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.unsubscribeUrl ? { headers } : {}),
      }),
      signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
    });
    // One anonymous telemetry row per outcome (docs/specs/017-telemetry/telemetry.md), written server-side
    // because nothing about an email reaches a browser: the send happens in a
    // cron or a waitUntil after the response has gone. Without it the lifecycle
    // series (docs/specs/014-identity/transactional-email.md) was unmeasurable and a dead RESEND_API_KEY was invisible.
    // reportServerEvent gates on TELEMETRY_ENABLED and swallows its own failure.
    if (!res.ok) {
      console.error(
        `[email] send failed (${res.status}) subject="${msg.subject}" to=${redact(msg.to)}`,
      );
      await reportServerEvent(env, 'Error', 'Api', `Http${res.status}.SendEmail`);
      return { sent: false };
    }
    await reportServerEvent(env, 'Email', 'Sent', msg.kind);
    return { sent: true };
  } catch (err) {
    console.error(`[email] send threw subject="${msg.subject}" to=${redact(msg.to)}`, err);
    await reportServerEvent(env, 'Error', 'Api', 'Network.SendEmail');
    return { sent: false };
  }
}

// Log addresses partially so `wrangler tail` stays useful without dumping full
// emails into the log stream.
function redact(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}
