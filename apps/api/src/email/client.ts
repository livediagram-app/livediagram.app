// spec/64: Resend client. The whole email feature is gated on RESEND_API_KEY:
// absent, every send is a no-op and the lifecycle table is never touched, so a
// deployment with email off does zero extra work (mirrors the OPENAI_API_KEY ->
// AI-hidden pattern). Sends are best-effort: this never throws, so an email or
// network failure can't fail or delay the request that triggered it (callers
// run sends inside ctx.waitUntil or the daily cron).

import type { Env } from '../types';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'livediagram <hello@livediagram.app>';
const DEFAULT_BASE_URL = 'https://livediagram.app';

export function emailEnabled(env: Env): boolean {
  return typeof env.RESEND_API_KEY === 'string' && env.RESEND_API_KEY.length > 0;
}

// Public origin for links in emails. Trailing slashes stripped so callers can
// always template `${appBaseUrl(env)}/path`.
export function appBaseUrl(env: Env): string {
  return (env.APP_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
}

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  // For opt-out emails: a URL where the recipient can manage / turn off this
  // category. Emitted as a `List-Unsubscribe` header so mail clients can surface
  // a native unsubscribe affordance (we point it at the profile page rather than
  // a one-click POST endpoint, by design — spec/64).
  unsubscribeUrl?: string;
};

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
    });
    if (!res.ok) {
      console.error(
        `[email] send failed (${res.status}) subject="${msg.subject}" to=${redact(msg.to)}`,
      );
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] send threw subject="${msg.subject}" to=${redact(msg.to)}`, err);
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
