// `migrate notify <bundle>… --snapshot <snapshot> --env staging|production [--clerk <users.csv>] [--preview <dir>]
// [--only <email>] [--send]` (docs/migration.md step 8 and "Tooling"): the one email to every migrated account.
//
// One recipient per account the bundles imported (their `"user"` rows) or merged onto (`owner-map.json`'s matches),
// deduplicated by address. Each account's sections are read from the snapshot through every old id that maps to it
// (its Clerk ids and the guests the old site folded into it). The accounts Worker renders and sends
// (`POST /api/auth/internal/migration-notice`, behind ADMIN_TOKEN) and claims each address first, so a re-run never
// sends one twice. Without `--send` every batch is a dry run: rendered, nothing claimed or sent.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseSync as Snapshot } from 'node:sqlite';
import type { MigrationApp, MovedParts } from '@liveworkspace/migration';
import { defaultPartUrl } from '@liveworkspace/migration/split';
import type { Http } from './apply.ts';
import { readClerkUsers } from './owner-map.ts';
import type { Manifest } from './plan/index.ts';
import type { Env } from './targets.ts';

/** One person's notice, as the accounts Worker's route takes it (liveworkspace/apps/accounts/src/migration-notice.ts). */
export type NotifyRecipient = {
  email: string;
  name: string;
  splitDocuments?: { name: string; parts: { app: MigrationApp; title: string; url: string }[] }[];
  splitDocumentsTotal?: number;
  hasTokens?: boolean;
  hasTeams?: boolean;
  hasAiTool?: boolean;
  hadDrive?: boolean;
};

/** The route's batch cap (NOTICE_BATCH_MAX): the tool sends this many a call. */
export const NOTIFY_BATCH = 50;
// What one recipient carries: the documents the email names (NOTICE_DOCUMENTS_SHOWN; the rest are counted),
// and the route's text cap (NOTICE_TEXT_MAX).
const DOCUMENTS_SHOWN = 10;
const TEXT_MAX = 200;

export const NOTIFY_PATH = '/api/auth/internal/migration-notice';
export const ACCOUNTS_ORIGIN_VAR = 'MIGRATE_ACCOUNTS_ORIGIN';
export const ADMIN_TOKEN_VAR = 'MIGRATE_ADMIN_TOKEN';

export const accountsOrigin = (env: Env): string =>
  env === 'staging' ? 'https://staging.liveworkspace.app' : 'https://www.liveworkspace.app';

// ---- Reading the bundles ------------------------------------------------------------------------------------------

/** A SQL file's statements, split at each `;` outside a quoted string (a name may hold `;` or a line break). */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  // A statement as run: the comment lines before it dropped.
  const push = (text: string) => {
    const s = text.replace(/^(\s*--[^\n]*(\n|$))+/, '').trim();
    if (s) out.push(s);
  };
  let start = 0;
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]!;
    if (quote) {
      if (c === quote) {
        // A doubled quote is the quote itself.
        if (sql[i + 1] === quote) i++;
        else quote = null;
      }
    } else if (c === "'" || c === '"') quote = c;
    else if (c === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end;
    } else if (c === ';') {
      push(sql.slice(start, i));
      start = i + 1;
    }
  }
  push(sql.slice(start));
  return out;
}

export type BundleUser = { id: string; email: string; name: string; givenName: string };

/** The `"user"` rows a bundle's accounts SQL writes, by id: each statement that writes one, run into a scratch table
 *  of the same columns, so the values are read exactly as SQLite reads them. */
export function readBundleUsers(bundleDir: string): Map<string, BundleUser> {
  const manifest = JSON.parse(readFileSync(join(bundleDir, 'manifest.json'), 'utf8')) as Manifest;
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT, givenName TEXT, familyName TEXT, email TEXT,
      emailVerified INTEGER, image TEXT, createdAt TEXT, updatedAt TEXT)`);
    for (const step of manifest.steps) {
      if (step.step !== 'sql' || step.db !== 'accounts') continue;
      for (const file of step.files) {
        for (const statement of splitStatements(readFileSync(join(bundleDir, file), 'utf8'))) {
          if (/^INSERT OR IGNORE INTO "user" \(/.test(statement)) db.exec(statement);
        }
      }
    }
    const out = new Map<string, BundleUser>();
    for (const row of db
      .prepare('SELECT id, email, name, givenName FROM "user" ORDER BY id')
      .all() as Record<string, string | null>[]) {
      out.set(row.id!, {
        id: row.id!,
        email: (row.email ?? '').trim().toLowerCase(),
        name: (row.name ?? '').trim(),
        givenName: (row.givenName ?? '').trim(),
      });
    }
    return out;
  } finally {
    db.close();
  }
}

type OwnerMapFile = {
  accounts: Record<string, string>;
  matches: { clerkId: string; accountId: string; email: string }[];
  aliases: Record<string, string>;
};

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

// ---- Building the recipients ---------------------------------------------------------------------------------------

export type NotifyInput = {
  /** Every bundle applied, oldest first: the owner map is the newest one's, the users and moved parts all of theirs. */
  bundleDirs: string[];
  snapshot: Snapshot;
  env: Env;
  /** Tokens live at this time count. */
  now: number;
  /** The Clerk export, for the names of accounts the import merged onto (no `"user"` row of the bundle's own). */
  clerkCsv?: string | null;
};

export type NotifyPlan = {
  recipients: NotifyRecipient[];
  /** Accounts with no address to send to, and why. */
  skipped: { account: string; reason: string }[];
};

const cut = (text: string, max = TEXT_MAX) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
// The route refuses control characters; a stored name could hold a line break.
// oxlint-disable-next-line no-control-regex
const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

/** A part's address in the environment's app (staging's apps on staging). */
export function partUrl(env: Env, app: MigrationApp, id: string): string {
  const url = defaultPartUrl(app, id, null);
  return env === 'staging' ? url.replace('https://www.', 'https://staging.') : url;
}

export function buildRecipients(input: NotifyInput): NotifyPlan {
  const { snapshot, env } = input;
  if (input.bundleDirs.length === 0) throw new Error('notify needs at least one bundle');
  const newest = input.bundleDirs.at(-1)!;
  const ownerMap = readJson<OwnerMapFile>(join(newest, 'owner-map.json'));
  const users = new Map<string, BundleUser>();
  const moved = new Map<string, MovedParts>();
  for (const dir of input.bundleDirs) {
    for (const [id, user] of readBundleUsers(dir)) users.set(id, user);
    for (const m of readJson<MovedParts[]>(join(dir, 'moved-parts.json'))) moved.set(m.oldId, m);
  }
  const clerk = new Map(
    input.clerkCsv ? readClerkUsers(input.clerkCsv).users.map((u) => [u.id, u]) : [],
  );

  // Every old id behind each account: its Clerk ids, and the guests the old site folded into it.
  const accountOf = new Map<string, string>();
  for (const [clerkId, accountId] of Object.entries(ownerMap.accounts))
    accountOf.set(clerkId, accountId);
  for (const [guest, owner] of Object.entries(ownerMap.aliases ?? {}))
    if (owner.startsWith('user_')) accountOf.set(guest, owner);
  const oldIds = new Map<string, string[]>();
  for (const [old, account] of [...accountOf.entries()].sort()) {
    const list = oldIds.get(account) ?? [];
    list.push(old);
    oldIds.set(account, list);
  }

  const ids = (sql: string, ...args: (string | number)[]) =>
    new Set(
      (snapshot.prepare(sql).all(...args) as { id: string | null }[])
        .map((r) => r.id)
        .filter((id): id is string => !!id),
    );
  const tokens = ids(
    'SELECT DISTINCT owner_id AS id FROM api_tokens WHERE revoked = 0 AND expires_at > ?',
    input.now,
  );
  const teams = ids(
    `SELECT DISTINCT user_id AS id FROM team_members
      WHERE user_id IS NOT NULL AND (status IS NULL OR status = 'joined')`,
  );
  const drive = ids('SELECT DISTINCT owner_id AS id FROM drive_connections');
  // What the old database records of an AI tool: documents its MCP server made (`source` 'mcp'), and changes made
  // with a token through the changeset route (kept 30 days on the old site).
  const ai = ids(
    `SELECT DISTINCT owner_id AS id FROM documents WHERE source = 'mcp'
     UNION SELECT DISTINCT author_id FROM agent_changesets WHERE token_id IS NOT NULL`,
  );

  // Each account's split documents (live ones it owns), with every part outside livediagram.
  const documentRow = snapshot.prepare(
    'SELECT name, owner_id, trashed_at FROM documents WHERE id = ?',
  );
  const tabName = snapshot.prepare('SELECT name FROM tabs WHERE id = ?');
  const split = new Map<string, NonNullable<NotifyRecipient['splitDocuments']>>();
  for (const m of [...moved.values()].sort((a, b) => (a.oldId < b.oldId ? -1 : 1))) {
    const doc = documentRow.get(m.oldId) as
      { name: string | null; owner_id: string; trashed_at: number | null } | undefined;
    if (!doc || doc.trashed_at !== null) continue;
    const account = accountOf.get(doc.owner_id);
    if (!account) continue;
    const name = cut(clean(doc.name ?? '') || 'Untitled');
    const parts = m.parts
      .filter((p) => p.app !== 'livediagram')
      .map((p) => {
        const tabs = p.tabIds
          .map((t) => clean((tabName.get(t) as { name: string | null } | undefined)?.name ?? ''))
          .filter(Boolean);
        return { app: p.app, title: cut(tabs.join(', ') || name), url: partUrl(env, p.app, p.id) };
      });
    if (parts.length === 0) continue;
    const list = split.get(account) ?? [];
    list.push({ name, parts });
    split.set(account, list);
  }

  const byEmail = new Map<string, NotifyRecipient>();
  const skipped: NotifyPlan['skipped'] = [];
  const matchEmail = new Map(ownerMap.matches.map((m) => [m.accountId, m.email]));
  for (const [account, olds] of [...oldIds.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!olds.some((o) => o.startsWith('user_'))) continue;
    const user = users.get(account);
    const email = (user?.email || matchEmail.get(account) || '').toLowerCase();
    if (!email) {
      skipped.push({ account, reason: 'no address in the bundles' });
      continue;
    }
    if (email.endsWith('.invalid')) {
      skipped.push({ account, reason: 'an .invalid address' });
      continue;
    }
    const fromClerk = olds.map((o) => clerk.get(o)).find((u) => u && (u.givenName || u.name));
    const name = cut(
      clean(user?.givenName || user?.name || fromClerk?.givenName || fromClerk?.name || ''),
      120,
    );
    const has = (set: Set<string>) => olds.some((o) => set.has(o));
    const r: NotifyRecipient = byEmail.get(email) ?? { email, name };
    if (!r.name && name) r.name = name;
    const all = [...(r.splitDocuments ?? []), ...(split.get(account) ?? [])];
    const total =
      (r.splitDocumentsTotal ?? r.splitDocuments?.length ?? 0) + (split.get(account)?.length ?? 0);
    if (all.length) r.splitDocuments = all.slice(0, DOCUMENTS_SHOWN);
    if (total > DOCUMENTS_SHOWN) r.splitDocumentsTotal = total;
    if (has(tokens)) r.hasTokens = true;
    if (has(teams)) r.hasTeams = true;
    if (has(ai)) r.hasAiTool = true;
    if (has(drive)) r.hadDrive = true;
    byEmail.set(email, r);
  }
  return {
    recipients: [...byEmail.values()].sort((a, b) => (a.email < b.email ? -1 : 1)),
    skipped,
  };
}

/** How many recipients get each section: what the run prints before it asks the Worker. */
export function sectionCounts(recipients: readonly NotifyRecipient[]) {
  const count = (has: (r: NotifyRecipient) => boolean) => recipients.filter(has).length;
  return {
    recipients: recipients.length,
    splitDocuments: count((r) => !!r.splitDocuments?.length),
    hasTokens: count((r) => !!r.hasTokens),
    hasTeams: count((r) => !!r.hasTeams),
    hasAiTool: count((r) => !!r.hasAiTool),
    hadDrive: count((r) => !!r.hadDrive),
  };
}

// ---- Sending -------------------------------------------------------------------------------------------------------

export type NotifyResult = {
  email: string;
  status: 'sent' | 'skipped' | 'failed' | 'preview';
  reason?: string;
  wouldSkip?: string;
  subject?: string;
  html?: string;
  text?: string;
};

export type NotifyOptions = {
  recipients: NotifyRecipient[];
  env: Env;
  send: boolean;
  http: Http;
  /** Where MIGRATE_ACCOUNTS_ORIGIN and MIGRATE_ADMIN_TOKEN are read (process.env in the CLI). */
  vars: Record<string, string | undefined>;
  preview?: string | null;
  log?: (line: string) => void;
};

export type NotifySummary = { sent: number; skipped: number; failed: number; previewed: number };

/** A file name for an address in the preview folder. */
export const previewName = (email: string) => email.replace(/[^a-z0-9@._-]/gi, '_');

export async function notify(o: NotifyOptions): Promise<NotifySummary> {
  const log = o.log ?? ((line: string) => console.log(line));
  const token = o.vars[ADMIN_TOKEN_VAR];
  if (!token)
    throw new Error(`${ADMIN_TOKEN_VAR} is not set (see liveworkspace/apps/migrate/README.md)`);
  const url = `${(o.vars[ACCOUNTS_ORIGIN_VAR] || accountsOrigin(o.env)).replace(/\/+$/, '')}${NOTIFY_PATH}`;
  if (o.preview) mkdirSync(o.preview, { recursive: true });
  const summary: NotifySummary = { sent: 0, skipped: 0, failed: 0, previewed: 0 };
  for (let at = 0; at < o.recipients.length; at += NOTIFY_BATCH) {
    const batch = o.recipients.slice(at, at + NOTIFY_BATCH);
    const response = await o.http.send({
      method: 'POST',
      url,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ recipients: batch, ...(o.send ? {} : { dryRun: true }) }),
    });
    if (response.status !== 200) {
      // The token is never printed; the answer is the Worker's own.
      throw new Error(
        `batch ${at / NOTIFY_BATCH + 1}: the accounts Worker answered ${response.status}: ${response.body.slice(0, 500)}`,
      );
    }
    const { results } = JSON.parse(response.body) as { results: NotifyResult[] };
    for (const r of results) {
      if (r.status === 'preview') {
        summary.previewed++;
        if (o.preview) {
          writeFileSync(join(o.preview, `${previewName(r.email)}.html`), r.html ?? '');
          writeFileSync(join(o.preview, `${previewName(r.email)}.txt`), r.text ?? '');
        }
        if (r.wouldSkip) log(`would skip ${r.email}: ${r.wouldSkip}`);
      } else {
        summary[r.status]++;
        if (r.status !== 'sent') log(`${r.status} ${r.email}${r.reason ? `: ${r.reason}` : ''}`);
      }
    }
    log(
      `batch ${at / NOTIFY_BATCH + 1}: ${batch.length} ${o.send ? 'sent through' : 'previewed by'} the accounts Worker`,
    );
  }
  log(
    o.send
      ? `${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed`
      : `${summary.previewed} previewed, nothing sent${o.preview ? ` (written to ${o.preview})` : ''}`,
  );
  return summary;
}
