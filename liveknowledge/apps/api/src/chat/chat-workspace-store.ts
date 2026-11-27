// What one connected Slack workspace or Teams tenant keeps (docs/specs/030-knowledgebase/blueprints/chat-apps.md "The
// ChatWorkspace's tables"): its install, its linked people, the links waiting to be completed, the answers kept for
// Share in Channel, the request keys it has seen and the work it owes. A Teams connect code is an instance of its own
// holding the one `code` row; a knowledgebase's own instance (`kb:<id>`) holds its `connections`, one a platform. Each table is bounded; nothing here is a knowledgebase's content. Pure over the
// Durable Object's `sql.exec`, so the tests run it on node:sqlite.
import { REPLAY_KEEP_MS, type ChatPlatform } from '@liveworkspace/chat';

export type ChatSql = {
  exec(query: string, ...bindings: (string | number | null)[]): { toArray(): unknown[] };
};

/** The most linked people (and, apart, links waiting) one workspace keeps. */
export const CHAT_LINKS_MAX = 5000;
/** The most answers kept for Share in Channel. */
export const CHAT_ANSWERS_MAX = 200;
/** The most request keys kept to refuse a replay. */
export const CHAT_SEEN_MAX = 5000;
/** The most questions and previews waiting. */
export const CHAT_JOBS_MAX = 200;
/** A link's code lasts this long (chat-apps.md "Linking an account": 30 minutes). */
export const CHAT_LINK_TTL_MS = 1_800_000;
/** An answer can be shared for this long (Slack's response_url lasts 30 minutes). */
export const CHAT_ANSWER_KEEP_MS = 1_800_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS install (id INTEGER PRIMARY KEY CHECK (id = 1), platform TEXT NOT NULL,
  workspace TEXT NOT NULL, name TEXT NOT NULL, knowledgebase TEXT NOT NULL, connected_by TEXT NOT NULL,
  connected_at INTEGER NOT NULL, token TEXT, bot_user TEXT, service_url TEXT);
CREATE TABLE IF NOT EXISTS links (user TEXT PRIMARY KEY, person TEXT NOT NULL, user_name TEXT,
  linked_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS pending_links (user TEXT PRIMARY KEY, nonce TEXT NOT NULL, user_name TEXT,
  expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS answers (id TEXT PRIMARY KEY, user TEXT NOT NULL, body TEXT NOT NULL,
  expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS seen (key TEXT PRIMARY KEY, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, body TEXT NOT NULL,
  at INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS code (id INTEGER PRIMARY KEY CHECK (id = 1), knowledgebase TEXT NOT NULL,
  person TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS connections (platform TEXT PRIMARY KEY, workspace TEXT NOT NULL, name TEXT NOT NULL,
  connected_by TEXT NOT NULL, connected_at INTEGER NOT NULL);
`;

export type ChatInstall = {
  platform: ChatPlatform;
  workspace: string;
  name: string;
  knowledgebase: string;
  connectedBy: string;
  connectedAt: number;
  /** Slack's bot token, sealed; null for Teams. */
  token: string | null;
  botUser: string | null;
  serviceUrl: string | null;
};

export type ChatJob = { id: number; kind: string; body: string; tries: number };

const rows = <T>(sql: ChatSql, query: string, ...bindings: (string | number | null)[]) =>
  sql.exec(query, ...bindings).toArray() as T[];

const count = (sql: ChatSql, table: string) =>
  rows<{ n: number }>(sql, `SELECT COUNT(*) AS n FROM ${table}`)[0]!.n;

export function migrateChatWorkspace(sql: ChatSql): void {
  for (const statement of SCHEMA.split(';').map((s) => s.trim()))
    if (statement) sql.exec(statement);
}

type InstallRow = {
  platform: ChatPlatform;
  workspace: string;
  name: string;
  knowledgebase: string;
  connected_by: string;
  connected_at: number;
  token: string | null;
  bot_user: string | null;
  service_url: string | null;
};

export function readInstall(sql: ChatSql): ChatInstall | null {
  const row = rows<InstallRow>(sql, 'SELECT * FROM install WHERE id = 1')[0];
  if (!row) return null;
  return {
    platform: row.platform,
    workspace: row.workspace,
    name: row.name,
    knowledgebase: row.knowledgebase,
    connectedBy: row.connected_by,
    connectedAt: row.connected_at,
    token: row.token,
    botUser: row.bot_user,
    serviceUrl: row.service_url,
  };
}

/** The install written: `taken` when the workspace is another knowledgebase's. The same knowledgebase again
 *  replaces its token and keeps its linked people. */
export function writeInstall(sql: ChatSql, install: ChatInstall): 'ok' | 'taken' {
  const held = readInstall(sql);
  if (held && held.knowledgebase !== install.knowledgebase) return 'taken';
  sql.exec(
    `INSERT INTO install (id, platform, workspace, name, knowledgebase, connected_by, connected_at, token, bot_user,
       service_url) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET name = excluded.name, connected_by = excluded.connected_by,
       connected_at = excluded.connected_at, token = excluded.token, bot_user = excluded.bot_user,
       service_url = COALESCE(excluded.service_url, install.service_url)`,
    install.platform,
    install.workspace,
    install.name,
    install.knowledgebase,
    install.connectedBy,
    install.connectedAt,
    install.token,
    install.botUser,
    install.serviceUrl,
  );
  return 'ok';
}

/** Teams' last checked service address, kept so a queued answer knows where to go. */
export function noteServiceUrl(sql: ChatSql, serviceUrl: string): void {
  sql.exec('UPDATE install SET service_url = ? WHERE id = 1', serviceUrl);
}

/** Everything forgotten (chat-apps.md "Disconnect forgets"). */
export function forgetAll(sql: ChatSql): void {
  for (const table of ['install', 'links', 'pending_links', 'answers', 'jobs'])
    sql.exec(`DELETE FROM ${table}`);
}

/** Whether `key` was seen inside the replay window; records it either way. */
export function seenBefore(sql: ChatSql, key: string, now: number): boolean {
  const held = rows<{ at: number }>(sql, 'SELECT at FROM seen WHERE key = ?', key)[0];
  if (held && now - held.at < REPLAY_KEEP_MS) return true;
  sql.exec(
    'INSERT INTO seen (key, at) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET at = excluded.at',
    key,
    now,
  );
  if (count(sql, 'seen') > CHAT_SEEN_MAX)
    sql.exec('DELETE FROM seen WHERE key IN (SELECT key FROM seen ORDER BY at LIMIT ?)', 100);
  return false;
}

export type ChatLink = { person: string; userName: string | null };

export function linkOf(sql: ChatSql, user: string): ChatLink | null {
  const row = rows<{ person: string; user_name: string | null }>(
    sql,
    'SELECT person, user_name FROM links WHERE user = ?',
    user,
  )[0];
  return row ? { person: row.person, userName: row.user_name } : null;
}

const sha256 = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** A fresh nonce for the user's link code, replacing any unused one. Only its hash is kept. */
export async function startLink(
  sql: ChatSql,
  user: string,
  userName: string | null,
  now: number,
): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  sql.exec(
    `INSERT INTO pending_links (user, nonce, user_name, expires) VALUES (?, ?, ?, ?)
     ON CONFLICT (user) DO UPDATE SET nonce = excluded.nonce, user_name = excluded.user_name,
       expires = excluded.expires`,
    user,
    await sha256(nonce),
    userName,
    now + CHAT_LINK_TTL_MS,
  );
  if (count(sql, 'pending_links') > CHAT_LINKS_MAX)
    sql.exec(
      'DELETE FROM pending_links WHERE user IN (SELECT user FROM pending_links ORDER BY expires LIMIT ?)',
      count(sql, 'pending_links') - CHAT_LINKS_MAX,
    );
  return nonce;
}

/** The waiting link the code names, while it lasts. */
export async function pendingLink(
  sql: ChatSql,
  user: string,
  nonce: string,
  now: number,
): Promise<{ userName: string | null } | null> {
  const row = rows<{ nonce: string; user_name: string | null; expires: number }>(
    sql,
    'SELECT nonce, user_name, expires FROM pending_links WHERE user = ?',
    user,
  )[0];
  if (!row || row.expires <= now || row.nonce !== (await sha256(nonce))) return null;
  return { userName: row.user_name };
}

/** The link completed for `person`, once: `expired` for a used, replaced or old code; `full` past the cap. */
export async function completeLink(
  sql: ChatSql,
  user: string,
  nonce: string,
  person: string,
  now: number,
): Promise<'ok' | 'expired' | 'full'> {
  const pending = await pendingLink(sql, user, nonce, now);
  if (!pending) return 'expired';
  if (!linkOf(sql, user) && count(sql, 'links') >= CHAT_LINKS_MAX) return 'full';
  sql.exec('DELETE FROM pending_links WHERE user = ?', user);
  sql.exec(
    `INSERT INTO links (user, person, user_name, linked_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user) DO UPDATE SET person = excluded.person, user_name = excluded.user_name,
       linked_at = excluded.linked_at`,
    user,
    person,
    pending.userName,
    now,
  );
  return 'ok';
}

export function unlink(sql: ChatSql, user: string): boolean {
  const had = linkOf(sql, user) !== null;
  sql.exec('DELETE FROM links WHERE user = ?', user);
  sql.exec('DELETE FROM pending_links WHERE user = ?', user);
  return had;
}

/** A job queued, or `full` past CHAT_JOBS_MAX. */
export function queueJob(sql: ChatSql, kind: string, body: string, now: number): 'queued' | 'full' {
  if (count(sql, 'jobs') >= CHAT_JOBS_MAX) return 'full';
  sql.exec('INSERT INTO jobs (kind, body, at) VALUES (?, ?, ?)', kind, body, now);
  return 'queued';
}

export function nextJobs(sql: ChatSql, limit: number): ChatJob[] {
  return rows<ChatJob>(sql, 'SELECT id, kind, body, tries FROM jobs ORDER BY id LIMIT ?', limit);
}

export const doneJob = (sql: ChatSql, id: number) =>
  void sql.exec('DELETE FROM jobs WHERE id = ?', id);
export const retryJob = (sql: ChatSql, id: number) =>
  void sql.exec('UPDATE jobs SET tries = tries + 1 WHERE id = ?', id);
export const jobsWaiting = (sql: ChatSql) => count(sql, 'jobs');

export function keepAnswer(
  sql: ChatSql,
  id: string,
  user: string,
  body: string,
  now: number,
): void {
  sql.exec(
    'INSERT OR REPLACE INTO answers (id, user, body, expires) VALUES (?, ?, ?, ?)',
    id,
    user,
    body,
    now + CHAT_ANSWER_KEEP_MS,
  );
  if (count(sql, 'answers') > CHAT_ANSWERS_MAX)
    sql.exec('DELETE FROM answers WHERE id IN (SELECT id FROM answers ORDER BY expires LIMIT 1)');
}

/** The answer kept for its asker, once: someone else's id, or one that lapsed, is null. */
export function takeAnswer(sql: ChatSql, id: string, user: string, now: number): string | null {
  const row = rows<{ body: string }>(
    sql,
    'SELECT body FROM answers WHERE id = ? AND user = ? AND expires > ?',
    id,
    user,
    now,
  )[0];
  if (row) sql.exec('DELETE FROM answers WHERE id = ?', id);
  return row?.body ?? null;
}

export function putCode(
  sql: ChatSql,
  knowledgebase: string,
  person: string,
  expires: number,
): void {
  sql.exec(
    'INSERT OR REPLACE INTO code (id, knowledgebase, person, expires) VALUES (1, ?, ?, ?)',
    knowledgebase,
    person,
    expires,
  );
}

/** The code's knowledgebase and person, once, while it lasts. */
export function takeCode(
  sql: ChatSql,
  now: number,
): { knowledgebase: string; person: string } | null {
  const row = rows<{ knowledgebase: string; person: string; expires: number }>(
    sql,
    'SELECT knowledgebase, person, expires FROM code WHERE id = 1',
  )[0];
  sql.exec('DELETE FROM code');
  return row && row.expires > now ? { knowledgebase: row.knowledgebase, person: row.person } : null;
}

/** Expired rows swept: links waiting, answers, seen keys. */
export function sweep(sql: ChatSql, now: number): void {
  sql.exec('DELETE FROM pending_links WHERE expires <= ?', now);
  sql.exec('DELETE FROM answers WHERE expires <= ?', now);
  sql.exec('DELETE FROM seen WHERE at <= ?', now - REPLAY_KEEP_MS);
}

/** Whether anything is left to sweep later. */
export const holdsExpiring = (sql: ChatSql) =>
  count(sql, 'pending_links') + count(sql, 'answers') + count(sql, 'seen') > 0;

export type ChatConnection = {
  platform: ChatPlatform;
  workspace: string;
  name: string;
  connectedBy: string;
  connectedAt: number;
};

export function readConnections(sql: ChatSql): ChatConnection[] {
  return rows<{
    platform: ChatPlatform;
    workspace: string;
    name: string;
    connected_by: string;
    connected_at: number;
  }>(sql, 'SELECT * FROM connections ORDER BY platform').map((row) => ({
    platform: row.platform,
    workspace: row.workspace,
    name: row.name,
    connectedBy: row.connected_by,
    connectedAt: row.connected_at,
  }));
}

/** The connection kept: the one it replaced (another workspace on that platform), for the caller to forget. */
export function writeConnection(sql: ChatSql, connection: ChatConnection): ChatConnection | null {
  const before = readConnections(sql).find((c) => c.platform === connection.platform) ?? null;
  sql.exec(
    'INSERT OR REPLACE INTO connections (platform, workspace, name, connected_by, connected_at) VALUES (?, ?, ?, ?, ?)',
    connection.platform,
    connection.workspace,
    connection.name,
    connection.connectedBy,
    connection.connectedAt,
  );
  return before && before.workspace !== connection.workspace ? before : null;
}

/** The connection dropped; only when it still names `workspace` if that is given. */
export function dropConnection(
  sql: ChatSql,
  platform: ChatPlatform,
  workspace?: string,
): ChatConnection | null {
  const held = readConnections(sql).find((c) => c.platform === platform) ?? null;
  if (!held || (workspace !== undefined && held.workspace !== workspace)) return null;
  sql.exec('DELETE FROM connections WHERE platform = ?', platform);
  return held;
}
