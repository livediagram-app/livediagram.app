// Every email the platform sends, accounts' and each app's, goes out through Cloudflare Email Service's `send_email`
// binding (liveworkspace/docs/specs/003-accounts/email.md). This is the one place that calls it: a Worker declares the binding as
// `EMAIL`, names its sender in `EMAIL_FROM`, and hands each message here. No key to keep: the binding is the
// credential, and the sender must be on a domain onboarded to Email Service on this account.

/** The binding, as `@cloudflare/workers-types`' SendEmail satisfies it. */
export type EmailBinding = {
  send(message: {
    from: string | { email: string; name: string };
    to: string;
    subject: string;
    html: string;
    text?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }>;
};

export type Email = {
  /** `EMAIL_FROM`: a bare address, or `Name <address>`. */
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Where to turn this kind of email off, sent as List-Unsubscribe so mail clients can offer it. */
  unsubscribeUrl?: string;
};

// The longest a send may wait, though the binding answers in well under a second. A sign-in code is sent while
// the person waits on the page, and the apps' sends run in a cron batch, so a hung call must not hold either.
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

/** Sends `email`, resolving to its message id. Throws on a refusal (the error's `code` is Email Service's, such
 *  as E_RECIPIENT_SUPPRESSED) or after `timeoutMs`. */
export async function sendEmail(
  binding: EmailBinding,
  email: Email,
  timeoutMs = EMAIL_SEND_TIMEOUT_MS,
): Promise<string> {
  const send = binding.send({
    from: parseSender(email.from),
    to: email.to,
    subject: email.subject,
    html: email.html,
    ...(email.text !== undefined && { text: email.text }),
    ...(email.unsubscribeUrl && { headers: { 'List-Unsubscribe': `<${email.unsubscribeUrl}>` } }),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`email send timed out after ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  try {
    return (await Promise.race([send, timeout])).messageId;
  } finally {
    clearTimeout(timer);
  }
}

/** `Name <address>` as the binding takes it; a bare address stays as it is. Index scans, not a regex: the
 *  optional spaces around a name made a pattern backtrack quadratically on a long run of them. */
export function parseSender(from: string): string | { email: string; name: string } {
  const value = from.trim();
  const open = value.lastIndexOf('<');
  if (!value.endsWith('>') || open < 0) return value;
  const email = value.slice(open + 1, -1).trim();
  if (!email || /[<>\s]/.test(email)) return value;
  let name = value.slice(0, open).trim();
  if (name.length >= 2 && name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
  return name ? { email, name } : email;
}

/** An address cut down for a log line (`jo***@example.com`), so `wrangler tail` stays useful without dumping it.
 *  A short local part keeps fewer characters, so at least one is always hidden (`j***@`, `***@`). */
export function redactAddress(address: string): string {
  const at = address.indexOf('@');
  if (at < 1) return '***';
  return `${address.slice(0, Math.min(2, at - 1))}***${address.slice(at)}`;
}
