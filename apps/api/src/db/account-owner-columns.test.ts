import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1 } from '../test-sqlite-d1';
import { deleteAccount, migrateOwnerId } from './account';

// Every column that holds an owner id, and what account deletion and the
// guest -> account migration do with it (docs/specs/015-api/api.md, "Owner-keyed
// data"). The ledger is checked against the migrated schema, so a new table
// keyed on an owner fails here until it is classified; each entry is then
// proven against a real SQLite database, so a classification the code does
// not honour fails too.

type OwnerColumn = {
  table: string;
  column: string;
  // Narrows the rows the column keys, where one table holds several kinds.
  scope?: string;
  // Rows account deletion deliberately leaves behind, and why.
  deleteKeeps?: { when: string; why: string };
  migrate:
    | { kind: 'moves' }
    // The migration source is always a guest id (docs/specs/014-identity/auth-and-guest-access.md),
    // which never holds this row.
    | { kind: 'account-only' }
    | { kind: 'stays'; why: string };
};

const OWNER_COLUMNS: OwnerColumn[] = [
  { table: 'documents', column: 'owner_id', migrate: { kind: 'moves' } },
  {
    table: 'folders',
    column: 'owner_id',
    deleteKeeps: { when: 'team_id IS NOT NULL', why: 'a team folder belongs to the team' },
    migrate: { kind: 'moves' },
  },
  { table: 'shared_with', column: 'owner_id', migrate: { kind: 'moves' } },
  { table: 'favourites', column: 'owner_id', migrate: { kind: 'moves' } },
  // Default folders (docs/specs/013-workspace/default-folders.md): guests have them too.
  { table: 'placement_defaults', column: 'owner_id', migrate: { kind: 'moves' } },
  { table: 'user_preferences', column: 'owner_id', migrate: { kind: 'moves' } },
  { table: 'custom_themes', column: 'owner_id', migrate: { kind: 'moves' } },
  // Shape libraries (docs/specs/013-workspace/shape-libraries.md): guests have them too.
  { table: 'shape_libraries', column: 'owner_id', migrate: { kind: 'moves' } },
  // Explorer Home's opens (docs/specs/013-workspace/explorer-home.md): guests open documents too.
  { table: 'document_opens', column: 'owner_id', migrate: { kind: 'moves' } },
  { table: 'images', column: 'owner_id', migrate: { kind: 'moves' } },
  { table: 'participants', column: 'id', migrate: { kind: 'moves' } },
  { table: 'timeline_events', column: 'actor_id', migrate: { kind: 'moves' } },
  {
    table: 'timeline_event_scopes',
    column: 'scope_id',
    scope: "scope_type = 'user'",
    migrate: { kind: 'moves' },
  },
  {
    table: 'timeline_scope_state',
    column: 'scope_id',
    scope: "scope_type = 'user'",
    migrate: { kind: 'moves' },
  },
  { table: 'collab_index_state', column: 'owner_id', migrate: { kind: 'moves' } },
  { table: 'owner_aliases', column: 'owner_id', migrate: { kind: 'moves' } },
  {
    table: 'owner_aliases',
    column: 'alias_id',
    migrate: { kind: 'stays', why: 'the guest id is recorded as an alias of the account' },
  },
  // Agent changesets (docs/specs/024-agents/agent-changesets.md, CS27): a guest with an edit link
  // writes and reverts changesets too.
  { table: 'agent_changesets', column: 'author_id', migrate: { kind: 'moves' } },
  // Community (docs/specs/025-community/community.md): a guest copies a post as often as anyone; only a
  // signed-in person publishes one.
  { table: 'community_copies', column: 'copier_id', migrate: { kind: 'moves' } },
  { table: 'community_posts', column: 'author_id', migrate: { kind: 'account-only' } },
  { table: 'api_tokens', column: 'owner_id', migrate: { kind: 'account-only' } },
  { table: 'email_lifecycle', column: 'owner_id', migrate: { kind: 'account-only' } },
  { table: 'auth_accounts', column: 'owner_id', migrate: { kind: 'account-only' } },
  { table: 'team_members', column: 'user_id', migrate: { kind: 'account-only' } },
  // Google Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md): signed-in only.
  { table: 'drive_connections', column: 'owner_id', migrate: { kind: 'account-only' } },
  { table: 'drive_items', column: 'owner_id', migrate: { kind: 'account-only' } },
  // Workbench embeds (docs/specs/013-workspace/workbench-embeds.md): minted from a token, so account-only.
  { table: 'workbench_pairing_requests', column: 'owner_id', migrate: { kind: 'account-only' } },
  { table: 'workbench_pairings', column: 'owner_id', migrate: { kind: 'account-only' } },
  { table: 'workbench_tickets', column: 'owner_id', migrate: { kind: 'account-only' } },
  { table: 'workbench_sessions', column: 'owner_id', migrate: { kind: 'account-only' } },
];

// Column names that mark an owner-keyed column wherever they appear.
const OWNER_COLUMN_NAMES = ['owner_id', 'user_id'];

const ACCOUNT = 'user_account';
const OTHER = 'user_other';
const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const T0 = 1_700_000_000_000;

function label(c: OwnerColumn): string {
  return `${c.table}.${c.column}`;
}

function count(sql: DatabaseSync, c: OwnerColumn, ownerId: string, extra?: string): number {
  const where = [`${c.column} = ?`, c.scope, extra].filter(Boolean).join(' AND ');
  const row = sql.prepare(`SELECT COUNT(*) AS n FROM ${c.table} WHERE ${where}`).get(ownerId);
  return Number(row?.n);
}

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function liveDoc(sql: DatabaseSync, id: string, ownerId: string, teamId: string | null = null) {
  insert(sql, 'documents', {
    id,
    owner_id: ownerId,
    name: id,
    saved_at: T0,
    created_at: T0,
    shareable: 0,
    team_id: teamId,
  });
}

// A Community post of `documentId` by `authorId`, with its community link; once per document.
function communityPost(sql: DatabaseSync, documentId: string, authorId: string): string {
  const id = `p-${documentId}`;
  sql
    .prepare(
      "INSERT OR IGNORE INTO share_links (code, document_id, role, created_at, purpose) VALUES (?, ?, 'view', ?, 'community')",
    )
    .run(`c-${documentId}`, documentId, T0);
  sql
    .prepare(
      `INSERT OR IGNORE INTO community_posts
         (id, document_id, share_code, author_id, title, description, category, search_text, published_at, updated_at)
       VALUES (?, ?, ?, ?, 'Post', 'A post.', 'other', 'post', ?, ?)`,
    )
    .run(id, documentId, `c-${documentId}`, authorId, T0, T0);
  return id;
}

// One row in every guest-holdable owner-keyed column, keyed on `id`, starring
// and visiting a document `peer` owns as well as its own.
function seedGuestHoldable(sql: DatabaseSync, id: string, peerDocument: string) {
  insert(sql, 'participants', { id, name: 'Otter', color: '#ff8800', created_at: T0 });
  // A copy of the peer's Community post (the peer document's owner is its author).
  const peerPost = communityPost(sql, peerDocument, OTHER);
  insert(sql, 'community_copies', { post_id: peerPost, copier_id: id, created_at: T0 });
  liveDoc(sql, `d-${id}`, id);
  insert(sql, 'folders', {
    id: `f-${id}`,
    owner_id: id,
    name: 'Mine',
    created_at: T0,
    updated_at: T0,
  });
  insert(sql, 'favourites', { owner_id: id, document_id: `d-${id}`, created_at: T0 });
  insert(sql, 'favourites', { owner_id: id, document_id: peerDocument, created_at: T0 });
  insert(sql, 'shared_with', {
    owner_id: id,
    document_id: peerDocument,
    role: 'view',
    last_seen: T0,
  });
  for (const documentId of [`d-${id}`, peerDocument]) {
    insert(sql, 'document_opens', {
      owner_id: id,
      document_id: documentId,
      last_opened_at: T0,
      last_open_day: '2023-11-14',
    });
  }
  insert(sql, 'user_preferences', { owner_id: id, prefs: '{}', updated_at: T0 });
  insert(sql, 'placement_defaults', {
    owner_id: id,
    default_key: 'mode:draw',
    folder_id: `f-${id}`,
    updated_at: T0,
  });
  insert(sql, 'custom_themes', {
    id: `t-${id}`,
    owner_id: id,
    name: 'Mine',
    definition: '{}',
    created_at: T0,
    updated_at: T0,
  });
  insert(sql, 'shape_libraries', {
    id: `l-${id}`,
    owner_id: id,
    name: 'Team icons',
    source: 'drawio',
    items: '[]',
    created_at: T0,
    updated_at: T0,
  });
  insert(sql, 'images', {
    id: `i-${id}`,
    owner_id: id,
    content_type: 'image/png',
    byte_size: 1,
    width: 1,
    height: 1,
    sha256: `sha-${id}`,
    created_at: T0,
  });
  insert(sql, 'timeline_events', {
    id: `e-${id}`,
    actor_id: id,
    source_type: 'document',
    source_id: `d-${id}`,
    event_type: 'created',
    title: 'Created',
    occurred_at: T0,
    snapshot: '{}',
    created_at: T0,
  });
  insert(sql, 'timeline_event_scopes', {
    event_id: `e-${id}`,
    scope_type: 'user',
    scope_id: id,
    added_at: T0,
  });
  insert(sql, 'timeline_scope_state', { scope_type: 'user', scope_id: id, backfilled_at: T0 });
  insert(sql, 'collab_index_state', { owner_id: id, backfilled_at: T0 });
  insert(sql, 'owner_aliases', { owner_id: id, alias_id: `legacy-${id}`, created_at: T0 });
  // A changeset they wrote on the peer's document, which outlives their own documents.
  insert(sql, 'tabs', { id: `tab-${id}`, name: 'Board', data: '{"elements":[]}', updated_at: T0 });
  insert(sql, 'agent_changesets', {
    id: `cs-${id}`,
    document_id: peerDocument,
    tab_id: `tab-${id}`,
    rev: 1,
    author_id: id,
    author_name: 'Otter',
    author_color: '#ff8800',
    fingerprints: '{}',
    added: 1,
    changed: 0,
    removed: 0,
    created_at: T0,
  });
}

// The account-only rows: an API token, the lifecycle-email and first-seen
// rows, and a membership of a team `peer` has joined too.
function seedAccountOnly(sql: DatabaseSync, id: string, peer: string) {
  // A Community post of their own document.
  communityPost(sql, `d-${id}`, id);
  insert(sql, 'api_tokens', {
    id: `tok-${id}`,
    owner_id: id,
    token_hash: `hash-${id}`,
    created_at: T0,
    expires_at: T0 * 2,
    revoked: 0,
    read_only: 0,
  });
  insert(sql, 'email_lifecycle', { owner_id: id, email: `${id}@example.com`, created_at: T0 });
  insert(sql, 'auth_accounts', { owner_id: id, first_seen_at: T0 });
  insert(sql, 'drive_connections', { owner_id: id, status: 'connected', connected_at: T0 });
  insert(sql, 'drive_items', {
    owner_id: id,
    item_kind: 'document',
    ld_id: `d-`,
    drive_file_id: `file-`,
    name: 'x.livediagram',
    ld_name: 'x',
  });
  insert(sql, 'teams', { id: 'team-1', name: 'Team', created_at: T0, updated_at: T0 });
  for (const [n, userId] of [id, peer].entries()) {
    insert(sql, 'team_members', {
      id: `m-${userId}`,
      team_id: 'team-1',
      user_id: userId,
      role: 'admin',
      status: 'joined',
      created_at: T0 + n,
      updated_at: T0,
    });
  }
  liveDoc(sql, `d-team-${id}`, id, 'team-1');
  // A workbench pairing of their token, its pending request, a ticket and an open session.
  const workbenchRow = { owner_id: id, token_id: `tok-${id}`, origin: 'https://w.example' };
  insert(sql, 'workbench_pairing_requests', {
    ...workbenchRow,
    id: `wr-${id}`,
    code: `code-${id}`,
    status: 'pending',
    created_at: T0,
    expires_at: T0 * 2,
  });
  insert(sql, 'workbench_pairings', { ...workbenchRow, id: `wp-${id}`, created_at: T0 });
  const opened = {
    ...workbenchRow,
    pairing_id: `wp-${id}`,
    document_id: `d-team-${id}`,
    role: 'edit',
    created_at: T0,
    expires_at: T0 * 2,
  };
  insert(sql, 'workbench_tickets', { ...opened, ticket_hash: `th-${id}` });
  insert(sql, 'workbench_sessions', { ...opened, id: `ws-${id}`, secret_hash: `sh-${id}` });
  // A folder in a team this user already left: it stays with the team.
  insert(sql, 'teams', { id: 'team-left', name: 'Old team', created_at: T0, updated_at: T0 });
  insert(sql, 'folders', {
    id: `f-left-${id}`,
    owner_id: id,
    name: 'Shared',
    created_at: T0,
    updated_at: T0,
    team_id: 'team-left',
  });
}

function schemaOwnerColumns(sql: DatabaseSync): string[] {
  const tables = sql
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((t) => String(t.name));
  return tables.flatMap((table) =>
    sql
      .prepare(`SELECT name FROM pragma_table_info(?)`)
      .all(table)
      .map((c) => String(c.name))
      .filter((column) => OWNER_COLUMN_NAMES.includes(column))
      .map((column) => `${table}.${column}`),
  );
}

describe('owner-keyed columns (docs/specs/015-api/api.md)', () => {
  it('classifies every owner-keyed column the migrations create', () => {
    const { sql } = sqliteD1();
    const ledger = OWNER_COLUMNS.map(label);
    expect(ledger).toEqual(expect.arrayContaining(schemaOwnerColumns(sql)));
  });

  it('names only columns the migrations create', () => {
    const { sql } = sqliteD1();
    for (const c of OWNER_COLUMNS) {
      const columns = sql
        .prepare('SELECT name FROM pragma_table_info(?)')
        .all(c.table)
        .map((r) => r.name);
      expect(columns, label(c)).toContain(c.column);
    }
  });
});

describe('deleteAccount erases every owner-keyed row (docs/specs/015-api/api.md)', () => {
  function arrange() {
    const db = sqliteD1();
    insert(db.sql, 'participants', { id: OTHER, name: 'Peer', color: '#000', created_at: T0 });
    liveDoc(db.sql, 'd-other', OTHER);
    seedGuestHoldable(db.sql, ACCOUNT, 'd-other');
    seedAccountOnly(db.sql, ACCOUNT, OTHER);
    insert(db.sql, 'favourites', { owner_id: OTHER, document_id: 'd-other', created_at: T0 });
    // The sweep matches the owner on either side of an alias pair.
    insert(db.sql, 'owner_aliases', { owner_id: OTHER, alias_id: ACCOUNT, created_at: T0 });
    return db;
  }

  it('leaves no row keyed on the deleted owner', async () => {
    const { env, sql } = arrange();
    for (const c of OWNER_COLUMNS) expect(count(sql, c, ACCOUNT), label(c)).toBeGreaterThan(0);

    await deleteAccount(env, ACCOUNT);

    for (const c of OWNER_COLUMNS) {
      const kept = c.deleteKeeps ? `NOT (${c.deleteKeeps.when})` : undefined;
      expect(count(sql, c, ACCOUNT, kept), label(c)).toBe(0);
    }
  });

  it("erases the stars the owner placed on other people's documents", async () => {
    const { env, sql } = arrange();

    await deleteAccount(env, ACCOUNT);

    const stars = sql.prepare('SELECT owner_id, document_id FROM favourites').all();
    expect(stars.map((s) => ({ ...s }))).toEqual([{ owner_id: OTHER, document_id: 'd-other' }]);
  });

  it("keeps what belongs to someone else, a left team's folder included", async () => {
    const { env, sql } = arrange();

    await deleteAccount(env, ACCOUNT);

    const liveDocs = sql.prepare('SELECT id, owner_id FROM documents ORDER BY id').all();
    expect(liveDocs.map((d) => ({ ...d }))).toEqual([
      { id: 'd-other', owner_id: OTHER },
      { id: `d-team-${ACCOUNT}`, owner_id: OTHER },
    ]);
    const folders = sql.prepare('SELECT id FROM folders').all();
    expect(folders.map((f) => f.id)).toEqual([`f-left-${ACCOUNT}`]);
  });
});

describe('migrateOwnerId moves every guest-holdable row (docs/specs/015-api/api.md)', () => {
  function arrange() {
    const db = sqliteD1();
    liveDoc(db.sql, 'd-other', OTHER);
    seedGuestHoldable(db.sql, GUEST, 'd-other');
    return db;
  }

  it('leaves no guest-keyed row behind but the alias', async () => {
    const { env, sql } = arrange();
    const moves = OWNER_COLUMNS.filter((c) => c.migrate.kind === 'moves');
    for (const c of moves) expect(count(sql, c, GUEST), label(c)).toBeGreaterThan(0);

    await migrateOwnerId(env, GUEST, ACCOUNT);

    for (const c of moves) {
      expect(count(sql, c, GUEST), `${label(c)} left on the guest`).toBe(0);
      expect(count(sql, c, ACCOUNT), `${label(c)} missing on the account`).toBeGreaterThan(0);
    }
    for (const c of OWNER_COLUMNS.filter((c) => c.migrate.kind === 'stays')) {
      expect(count(sql, c, GUEST), label(c)).toBeGreaterThan(0);
    }
  });

  it('counts one copier when both identities copied the same Community post', async () => {
    const { env, sql } = arrange();
    // The account copied the post too, from another device.
    insert(sql, 'community_copies', { post_id: 'p-d-other', copier_id: ACCOUNT, created_at: T0 });
    sql.prepare("UPDATE community_posts SET copy_count = 2 WHERE id = 'p-d-other'").run();

    await migrateOwnerId(env, GUEST, ACCOUNT);

    const copiers = sql.prepare('SELECT copier_id FROM community_copies').all();
    expect(copiers.map((c) => c.copier_id)).toEqual([ACCOUNT]);
    const post = sql.prepare("SELECT copy_count FROM community_posts WHERE id = 'p-d-other'").get();
    expect(post?.copy_count).toBe(1);
  });

  it('keeps the account star when both identities starred the same document', async () => {
    const { env, sql } = arrange();
    // The account starred d-other first, from another device.
    insert(sql, 'favourites', { owner_id: ACCOUNT, document_id: 'd-other', created_at: T0 - 5 });

    await migrateOwnerId(env, GUEST, ACCOUNT);

    const stars = sql
      .prepare('SELECT owner_id, document_id, created_at FROM favourites ORDER BY document_id')
      .all();
    expect(stars.map((s) => ({ ...s }))).toEqual([
      { owner_id: ACCOUNT, document_id: `d-${GUEST}`, created_at: T0 },
      { owner_id: ACCOUNT, document_id: 'd-other', created_at: T0 - 5 },
    ]);
  });

  it('keeps a tab-scoped visit scoped to its tab (docs/specs/013-workspace/tab-scoped-share-links.md)', async () => {
    const { env, sql } = arrange();
    sql.prepare("UPDATE shared_with SET tab_id = 't-2' WHERE owner_id = ?").run(GUEST);

    await migrateOwnerId(env, GUEST, ACCOUNT);

    const rows = sql.prepare('SELECT tab_id FROM shared_with WHERE owner_id = ?').all(ACCOUNT);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.tab_id).toBe('t-2');
  });

  it("keeps the account's participant row over the guest's", async () => {
    const { env, sql } = arrange();
    insert(sql, 'participants', { id: ACCOUNT, name: 'Ada', color: '#123456', created_at: T0 });

    await migrateOwnerId(env, GUEST, ACCOUNT);

    const people = sql.prepare('SELECT id, name, color FROM participants').all();
    expect(people.map((p) => ({ ...p }))).toEqual([{ id: ACCOUNT, name: 'Ada', color: '#123456' }]);
  });

  // A row older than GUEST_SIGNING_LIVE_AT marks a legacy id that may upgrade unsigned, so the new
  // id must never inherit the old date (docs/specs/015-api/public-api-and-tokens.md §6).
  it('stamps the moved participant row with the time of the move, never the old date', async () => {
    const { env, sql } = arrange();
    const before = Date.now();

    await migrateOwnerId(env, GUEST, ACCOUNT);

    const row = sql.prepare('SELECT created_at FROM participants WHERE id = ?').get(ACCOUNT) as {
      created_at: number;
    };
    expect(row.created_at).toBeGreaterThanOrEqual(before);
    expect(row.created_at).not.toBe(T0);
  });

  it('renames a guest library whose name the account already uses', async () => {
    const { env, sql } = arrange();
    insert(sql, 'shape_libraries', {
      id: 'l-account',
      owner_id: ACCOUNT,
      name: 'team ICONS',
      source: 'drawio',
      items: '[]',
      created_at: T0 - 5,
      updated_at: T0 - 5,
    });

    await migrateOwnerId(env, GUEST, ACCOUNT);

    const libraries = sql
      .prepare('SELECT id, owner_id, name FROM shape_libraries ORDER BY id')
      .all();
    expect(libraries.map((l) => ({ ...l }))).toEqual([
      { id: `l-${GUEST}`, owner_id: ACCOUNT, name: 'Team icons (2)' },
      { id: 'l-account', owner_id: ACCOUNT, name: 'team ICONS' },
    ]);
  });

  it('is a no-op on a second run', async () => {
    const { env, sql } = arrange();
    await migrateOwnerId(env, GUEST, ACCOUNT);
    const before = sql.prepare('SELECT * FROM favourites ORDER BY document_id').all();

    await expect(migrateOwnerId(env, GUEST, ACCOUNT)).resolves.toEqual({
      documents: 0,
      folders: 0,
      shared: 0,
      images: 0,
    });
    expect(sql.prepare('SELECT * FROM favourites ORDER BY document_id').all()).toEqual(before);
  });
});
