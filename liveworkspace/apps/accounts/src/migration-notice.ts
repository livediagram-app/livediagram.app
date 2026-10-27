// The one migration notice to everyone moved from the old livediagram.app (liveworkspace/docs/specs/003-accounts/accounts.md
// "Emails", docs/migration.md step 8): liveworkspace's frame, from NOTICE_FROM, with a section per thing that applies
// to the person. Only the migrate tool's `notify` asks for it, behind ADMIN_TOKEN as client registration is.
//
//   POST /api/auth/internal/migration-notice  { recipients, dryRun? }  →  200 { sent, skipped, failed, results }
//
// Each address is claimed in `migration_notice` before its send, so a re-run never sends it twice.
import { redactAddress } from '@liveworkspace/email';
import { AUTH_BASE_PATH } from './auth-options.ts';
import { sendEmailAs } from './email.ts';
import { appUrl, emailBrand, frame, INK, MUTED, paragraph } from './email-layout.ts';
import type { Env } from './env.ts';
import { sameSecret } from './secrets.ts';

export const MIGRATION_NOTICE_PATH = `${AUTH_BASE_PATH}/internal/migration-notice`;
// Recipients one call takes: the tool sends in batches of this many.
export const NOTICE_BATCH_MAX = 50;
// Split documents one recipient's email lists, and the parts one document has (one per app).
export const NOTICE_DOCUMENTS_MAX = 50;
export const NOTICE_PARTS_MAX = 4;
// Split documents the email lists by name; the rest are counted ("and N more").
export const NOTICE_DOCUMENTS_SHOWN = 10;
// A person's name, and a document's name or a part's title.
export const NOTICE_NAME_MAX = 120;
export const NOTICE_TEXT_MAX = 200;
const EMAIL_MAX = 254;

export const NOTICE_SUBJECT = 'livediagram is now part of liveworkspace';
const CONTACT_FORM = 'https://www.liveplanner.app/form/90Bgj5sY9eTpVrjhx9tTZj';

export const NOTICE_APPS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const;
export type NoticeApp = (typeof NOTICE_APPS)[number];

export type NoticePart = { app: NoticeApp; title: string; url: string };
export type SplitDocument = { name: string; parts: NoticePart[] };

export type NoticeRecipient = {
  email: string;
  name: string;
  splitDocuments?: SplitDocument[];
  // The person's whole count of split documents, when the list holds only some of them.
  splitDocumentsTotal?: number;
  hasTokens?: boolean;
  hasTeams?: boolean;
  hasAiTool?: boolean;
  hadDrive?: boolean;
};

export type NoticeEmail = { subject: string; html: string; text: string };

export type NoticeResult = {
  email: string;
  status: 'sent' | 'skipped' | 'failed' | 'preview';
  reason?: 'already_sent' | 'no_account' | string;
  wouldSkip?: 'already_sent' | 'no_account';
  messageId?: string | null;
} & Partial<NoticeEmail>;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Trailing slashes dropped by a scan, not /\/+$/, which is quadratic on a run of slashes.
const origin = (url: string) => {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
};

// ---- Checking the body ------------------------------------------------------------------------------------------

// No control characters (a line break in a name would break the plain-text part's lines).
// oxlint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

const isText = (v: unknown, max: number, min = 1): v is string =>
  typeof v === 'string' && v.trim().length >= min && v.length <= max && !CONTROL.test(v);

const isFlag = (v: unknown) => v === undefined || typeof v === 'boolean';

/** Whether `url` is an https address on `app`'s own domain (www., staging. or the bare domain). */
export function isPartUrl(app: NoticeApp, url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 2048) return false;
  try {
    const u = new URL(url);
    const domain = `${app}.app`;
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      [domain, `www.${domain}`, `staging.${domain}`].includes(u.hostname)
    );
  } catch {
    return false;
  }
}

function checkPart(v: unknown, at: string): string | null {
  if (!v || typeof v !== 'object') return `${at} must be an object`;
  const p = v as Record<string, unknown>;
  if (typeof p.app !== 'string' || !(NOTICE_APPS as readonly string[]).includes(p.app))
    return `${at}.app must be one of ${NOTICE_APPS.join(', ')}`;
  if (!isText(p.title, NOTICE_TEXT_MAX))
    return `${at}.title must be 1 to ${NOTICE_TEXT_MAX} characters`;
  if (!isPartUrl(p.app as NoticeApp, p.url)) return `${at}.url must be https on ${p.app}.app`;
  return null;
}

function checkRecipient(v: unknown, at: string): string | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return `${at} must be an object`;
  const r = v as Record<string, unknown>;
  if (typeof r.email !== 'string' || r.email.length > EMAIL_MAX || !EMAIL.test(r.email))
    return `${at}.email is not an email address`;
  if (!isText(r.name, NOTICE_NAME_MAX, 0))
    return `${at}.name must be a string of at most ${NOTICE_NAME_MAX}`;
  for (const flag of ['hasTokens', 'hasTeams', 'hasAiTool', 'hadDrive'] as const)
    if (!isFlag(r[flag])) return `${at}.${flag} must be a boolean`;
  if (r.splitDocuments !== undefined) {
    if (!Array.isArray(r.splitDocuments) || r.splitDocuments.length > NOTICE_DOCUMENTS_MAX)
      return `${at}.splitDocuments must be a list of at most ${NOTICE_DOCUMENTS_MAX}`;
    for (const [i, d] of r.splitDocuments.entries()) {
      const where = `${at}.splitDocuments[${i}]`;
      if (!d || typeof d !== 'object') return `${where} must be an object`;
      const doc = d as Record<string, unknown>;
      if (!isText(doc.name, NOTICE_TEXT_MAX))
        return `${where}.name must be 1 to ${NOTICE_TEXT_MAX} characters`;
      if (!Array.isArray(doc.parts) || doc.parts.length < 1 || doc.parts.length > NOTICE_PARTS_MAX)
        return `${where}.parts must be 1 to ${NOTICE_PARTS_MAX} parts`;
      for (const [j, p] of doc.parts.entries()) {
        const problem = checkPart(p, `${where}.parts[${j}]`);
        if (problem) return problem;
      }
    }
  }
  const total = r.splitDocumentsTotal;
  if (
    total !== undefined &&
    (typeof total !== 'number' ||
      !Number.isSafeInteger(total) ||
      total < (Array.isArray(r.splitDocuments) ? r.splitDocuments.length : 0))
  )
    return `${at}.splitDocumentsTotal must be a whole number no smaller than splitDocuments`;
  return null;
}

/** The body as the route takes it, or the first problem with it. */
export function readNoticeBody(
  body: unknown,
): { recipients: NoticeRecipient[]; dryRun: boolean } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'the body must be an object' };
  const b = body as Record<string, unknown>;
  if (!isFlag(b.dryRun)) return { error: 'dryRun must be a boolean' };
  if (
    !Array.isArray(b.recipients) ||
    b.recipients.length < 1 ||
    b.recipients.length > NOTICE_BATCH_MAX
  )
    return { error: `recipients must be a list of 1 to ${NOTICE_BATCH_MAX}` };
  const seen = new Set<string>();
  for (const [i, r] of b.recipients.entries()) {
    const problem = checkRecipient(r, `recipients[${i}]`);
    if (problem) return { error: problem };
    const email = (r as NoticeRecipient).email.toLowerCase();
    if (seen.has(email)) return { error: `recipients[${i}].email is in the list twice` };
    seen.add(email);
  }
  return {
    recipients: (b.recipients as NoticeRecipient[]).map((r) => ({
      ...r,
      email: r.email.toLowerCase(),
      name: r.name.trim(),
    })),
    dryRun: b.dryRun === true,
  };
}

// ---- The email --------------------------------------------------------------------------------------------------

/** The notice for one recipient: liveworkspace's frame, an Open livediagram button, and a plain-text part. Every
 *  value the recipient carries is escaped. */
export function noticeEmail(
  env: Pick<Env, 'ENVIRONMENT' | 'BASE_URL'>,
  r: NoticeRecipient,
): NoticeEmail {
  const brand = emailBrand(env, null);
  const site = origin(env.BASE_URL);
  const livediagram = appUrl(env, 'livediagram.app');
  const tokens = `${site}/account/tokens`;
  const drive = `${site}/drive/connect`;
  const privacy = `${site}/privacy`;
  const link = (url: string, label = url) =>
    `<a href="${escapeHtml(url)}" style="color:${brand.accent};text-decoration:underline;word-break:break-word;overflow-wrap:anywhere">${escapeHtml(label)}</a>`;

  // Each block: its HTML and its plain-text lines.
  const blocks: { html: string; text: string[] }[] = [];
  const say = (html: string, text: string) =>
    blocks.push({ html: paragraph(html, 16), text: [text] });

  const greeting = r.name ? `Hi ${r.name},` : 'Hi,';
  say(escapeHtml(greeting), greeting);
  const intro =
    'livediagram has moved to its new home as part of liveworkspace, a set of apps that share one account: livediagram for diagrams, liveplanner for plans, livedocuments for documents and livedesign for designs.';
  say(escapeHtml(intro), intro);
  say(
    `${escapeHtml("There's nothing you need to do.")} Your work is all still there at the same address, ${link(livediagram)}. Sign in with the same email (<strong style="color:${INK}">${escapeHtml(r.email)}</strong>) using a code we send you, or with Google.`,
    `There's nothing you need to do. Your work is all still there at the same address, ${livediagram}. Sign in with the same email (${r.email}) using a code we send you, or with Google.`,
  );

  const docs = r.splitDocuments ?? [];
  if (docs.length > 0) {
    const lead =
      'Some of your documents now live in more than one app. Where a document mixed a diagram with pages, a plan or a design, each part now opens in the app made for it. The diagram stays in livediagram and links to the rest:';
    const shown = docs.slice(0, NOTICE_DOCUMENTS_SHOWN);
    const parts = shown.flatMap((d) => d.parts.map((p) => ({ doc: d.name, ...p })));
    const more = Math.max(r.splitDocumentsTotal ?? 0, docs.length) - shown.length;
    const rest =
      more > 0
        ? `And ${more} more ${more === 1 ? 'document' : 'documents'}: open any of them in livediagram and it links to its other parts.`
        : '';
    blocks.push({
      html: `${paragraph(escapeHtml(lead), 16)}
        <ul style="margin:10px 0 0;padding-left:20px">${parts
          .map(
            (p) =>
              `<li style="margin:0 0 6px;color:${MUTED};font-size:15px;line-height:1.6"><strong style="color:${INK}">${escapeHtml(p.doc)}</strong>: ${link(p.url, p.title)} in ${p.app}</li>`,
          )
          .join('')}</ul>${rest ? paragraph(escapeHtml(rest), 16) : ''}`,
      text: [
        lead,
        ...parts.map((p) => `- ${p.doc}: ${p.title} in ${p.app} (${p.url})`),
        ...(rest ? [rest] : []),
      ],
    });
  }
  if (r.hasTokens) {
    say(
      `${escapeHtml("Your API tokens still work until they expire. You'll now find them at")} ${link(tokens)}.`,
      `Your API tokens still work until they expire. You'll now find them at ${tokens}.`,
    );
  }
  if (r.hasTeams) {
    const teams =
      "Your teams came across with their members and roles. They're now managed in your liveworkspace account.";
    say(escapeHtml(teams), teams);
  }
  if (r.hasAiTool) {
    const ai =
      'If you use livediagram from an AI tool, you may need to reconnect it once: remove livediagram from the tool, then add it again. You can now connect liveplanner, livedocuments and livedesign to your AI tool too.';
    say(escapeHtml(ai), ai);
  }
  if (r.hadDrive) {
    say(
      `Google Drive sync needs connecting again, once. Nothing in your Drive was changed. Connect at ${link(drive)} and it syncs from every liveworkspace app.`,
      `Google Drive sync needs connecting again, once. Nothing in your Drive was changed. Connect at ${drive} and it syncs from every liveworkspace app.`,
    );
  }
  say(
    `Privacy: we changed our authentication provider, so our old one (Clerk) no longer holds your details. The updated policy is at ${link(privacy)}.`,
    `Privacy: we changed our authentication provider, so our old one (Clerk) no longer holds your details. The updated policy is at ${privacy}.`,
  );
  say(
    `If anything looks wrong or you have a question, use our contact form: ${link(CONTACT_FORM)}`,
    `If anything looks wrong or you have a question, use our contact form: ${CONTACT_FORM}`,
  );

  const html = frame(brand, {
    preheader: escapeHtml(
      "There's nothing you need to do: your work is all still there at the same address.",
    ),
    heading: NOTICE_SUBJECT,
    body: `${blocks.map((b) => b.html).join('\n        ')}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0">
          <tr><td style="border-radius:8px;background:${INK}">
            <a href="${escapeHtml(livediagram)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">Open livediagram</a>
          </td></tr>
        </table>`,
    footer: 'Thanks for using livediagram,<br>The liveworkspace team',
  });
  const text = [
    ...blocks.flatMap((b) => [...b.text, '']),
    `Open livediagram: ${livediagram}`,
    '',
    'Thanks for using livediagram,',
    'The liveworkspace team',
  ].join('\n');
  return { subject: NOTICE_SUBJECT, html, text };
}

// ---- The route --------------------------------------------------------------------------------------------------

const json = (body: unknown, status: number) => Response.json(body, { status });

// A send that timed out may still have gone, so its claim stays; any other refusal never sent anything.
const mayHaveGone = (error: unknown) => error instanceof Error && /timed out/i.test(error.message);

export async function migrationNotice(
  request: Request,
  env: Env,
  now = Date.now,
): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!env.ADMIN_TOKEN || !(await sameSecret(token, env.ADMIN_TOKEN))) {
    return new Response('Unauthorized', { status: 401 });
  }
  const read = readNoticeBody(await request.json().catch(() => null));
  if ('error' in read) return json({ error: 'bad_request', message: read.error }, 400);
  const { recipients, dryRun } = read;
  if (!dryRun && !env.NOTICE_FROM) return json({ error: 'not_configured' }, 503);

  const db = env.AUTH_DB;
  const emails = recipients.map((r) => r.email);
  const marks = emails.map(() => '?').join(', ');
  // One read each for the call: who has an account, and who was sent the notice already.
  const accounts = new Set(
    (
      await db
        .prepare(`SELECT email FROM "user" WHERE email IN (${marks})`)
        .bind(...emails)
        .all<{ email: string }>()
    ).results.map((row) => row.email.toLowerCase()),
  );
  const claimed = new Set(
    (
      await db
        .prepare(`SELECT email FROM migration_notice WHERE email IN (${marks})`)
        .bind(...emails)
        .all<{ email: string }>()
    ).results.map((row) => row.email),
  );

  const results: NoticeResult[] = [];
  for (const r of recipients) {
    const skip = !accounts.has(r.email)
      ? ('no_account' as const)
      : claimed.has(r.email)
        ? ('already_sent' as const)
        : null;
    if (dryRun) {
      results.push({
        email: r.email,
        status: 'preview',
        ...(skip && { wouldSkip: skip }),
        ...noticeEmail(env, r),
      });
      continue;
    }
    if (skip) {
      results.push({ email: r.email, status: 'skipped', reason: skip });
      continue;
    }
    // The claim, before the send: a second run, or two at once, finds it and skips.
    const won = await db
      .prepare(
        'INSERT INTO migration_notice (email, claimedAt) VALUES (?, ?) ON CONFLICT (email) DO NOTHING RETURNING email',
      )
      .bind(r.email, now())
      .first<string>('email');
    if (!won) {
      results.push({ email: r.email, status: 'skipped', reason: 'already_sent' });
      continue;
    }
    const email = noticeEmail(env, r);
    try {
      const messageId = await sendEmailAs(
        env,
        { to: r.email, subject: email.subject, html: email.html, text: email.text },
        env.NOTICE_FROM!,
      );
      await db
        .prepare('UPDATE migration_notice SET sentAt = ?, messageId = ? WHERE email = ?')
        .bind(now(), messageId, r.email)
        .run();
      console.log('[notice] sent', redactAddress(r.email));
      results.push({ email: r.email, status: 'sent', messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (mayHaveGone(error)) {
        await db
          .prepare('UPDATE migration_notice SET error = ? WHERE email = ?')
          .bind(message.slice(0, 500), r.email)
          .run();
      } else {
        await db.prepare('DELETE FROM migration_notice WHERE email = ?').bind(r.email).run();
      }
      console.error('[notice] failed', redactAddress(r.email), message);
      results.push({ email: r.email, status: 'failed', reason: message.slice(0, 200) });
    }
  }
  const count = (status: NoticeResult['status']) =>
    results.filter((x) => x.status === status).length;
  return json(
    {
      sent: count('sent'),
      skipped: count('skipped'),
      failed: count('failed'),
      ...(dryRun && { previewed: count('preview') }),
      results,
    },
    200,
  );
}
