// A document's share links and Shared with me rows into the index (docs/migration.md, step 2.3: "keeping each
// link's token so old share URLs still work").
// - Each old link goes to the part that holds what it shares: a tab's link to the part with that tab, a whole
//   document's to the part that kept the old id (which carries the notice of where the rest went).
// - Codes are upper-cased, as the index looks them up (its isShareCode, then toUpperCase). Two old codes the same but
//   for case would collide: the first (oldest) keeps the code, the other is reported and not carried.
// - A person the document was shared with sees every part in Shared with me. Each row needs a link row of its own
//   item (shared_with.share_code), so a part that holds none of the old links gets one derived link per level,
//   whose code nobody was ever sent.
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { MigrationRoomPayload, MovedParts } from '@liveworkspace/migration';
import { sha256Hex } from '../ids.ts';
import type { OldDocument } from '../read-documents.ts';
import type { PlanContext } from './context.ts';

type Row = Record<string, string | number | null>;
type Level = 'view' | 'participate' | 'edit';

const EXPIRIES = new Set(['never', 'week', 'month', 'sixMonths']);
// The old site's code alphabet (no 0/O, 1/I/L): a derived code reads like any other.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DERIVED_LENGTH = 14;

/** A share code made from a seed, the same every run. */
export function derivedShareCode(seed: string): string {
  const hex = sha256Hex(`migrated-share:${seed}`);
  let code = '';
  for (let i = 0; i < DERIVED_LENGTH; i++)
    code += ALPHABET[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % ALPHABET.length];
  return code;
}

const levelOf = (level: unknown, role: unknown): Level =>
  level === 'view' || level === 'participate' || level === 'edit'
    ? level
    : role === 'edit'
      ? 'edit'
      : 'view';

type Statements = { links: StatementSync; shared: StatementSync };
const statements = new WeakMap<DatabaseSync, Statements>();

// Prepared once per snapshot, not once per document.
function prepared(ctx: PlanContext): Statements {
  let found = statements.get(ctx.snapshot);
  if (!found) {
    found = {
      links: ctx.snapshot.prepare(
        'SELECT * FROM share_links WHERE document_id = ? ORDER BY created_at, code',
      ),
      shared: ctx.snapshot.prepare(
        'SELECT * FROM shared_with WHERE document_id = ? ORDER BY owner_id',
      ),
    };
    statements.set(ctx.snapshot, found);
  }
  return found;
}

export function writeShares(
  ctx: PlanContext,
  doc: OldDocument,
  parts: readonly MigrationRoomPayload[],
  _moved: MovedParts | null,
): void {
  const d = doc.input.document;
  const { links, shared } = prepared(ctx);
  const partOfTab = new Map<string, MigrationRoomPayload>();
  for (const p of parts) for (const t of p.tabs) partOfTab.set(t.id, p);
  const first = parts[0]!;
  // Each part's link codes, by level, for its Shared with me rows.
  const codesOf = new Map<string, Map<Level, string>>();
  const writeLink = (
    part: MigrationRoomPayload,
    code: string,
    values: {
      level: Level;
      tabId: string | null;
      expiry: string;
      expiresAt: number | null;
      createdAt: number;
      isPublic: 0 | 1;
    },
  ) => {
    ctx.sql.index.row({
      table: 'share_links',
      key: code,
      columns: [
        'code',
        'item_id',
        'level',
        'tab_id',
        'expiry',
        'expires_at',
        'created_at',
        'public',
      ],
      values: [
        code,
        part.id,
        values.level,
        values.tabId,
        values.expiry,
        values.expiresAt,
        values.createdAt,
        values.isPublic,
      ],
      conflict: ['code'],
      version: `${part.app}:${part.id}`,
    });
    let byLevel = codesOf.get(part.id);
    if (!byLevel) codesOf.set(part.id, (byLevel = new Map<Level, string>()));
    if (!byLevel.has(values.level) && values.tabId === null) byLevel.set(values.level, code);
  };

  for (const l of links.all(d.id) as Row[]) {
    const old = String(l.code);
    const code = old.toUpperCase();
    const tabId = l.tab_id === null ? null : String(l.tab_id);
    const part = (tabId && partOfTab.get(tabId)) || first;
    const taken = ctx.linkTargets.get(code);
    if (taken && (taken.code !== old || taken.id !== part.id)) {
      ctx.report.shareCodeCaseCollisions.push({ code: old, kept: taken.code, document: d.id });
      ctx.report.add('shareLinks.caseCollision');
      continue;
    }
    ctx.linkTargets.set(code, { app: part.app, id: part.id, code: old });
    const expiry = l.expiry !== null && EXPIRIES.has(String(l.expiry)) ? String(l.expiry) : 'never';
    writeLink(part, code, {
      level: levelOf(l.level, l.role),
      // A tab link whose tab is gone from the part shares the whole part.
      tabId: tabId && partOfTab.get(tabId) === part ? tabId : null,
      expiry,
      expiresAt: l.expires_at === null ? null : Number(l.expires_at),
      createdAt: Number(l.created_at),
      isPublic: l.purpose === 'community' ? 1 : 0,
    });
    ctx.report.add('shareLinks');
  }

  const rows = shared.all(d.id) as Row[];
  if (rows.length === 0) return;
  const codeFor = (part: MigrationRoomPayload, level: Level, wanted: string | null): string => {
    if (wanted) {
      const target = ctx.linkTargets.get(wanted.toUpperCase());
      if (target?.id === part.id) return wanted.toUpperCase();
    }
    const known = codesOf.get(part.id)?.get(level);
    if (known) return known;
    const code = derivedShareCode(`${part.id}:${level}`);
    writeLink(part, code, {
      level,
      tabId: null,
      expiry: 'never',
      expiresAt: null,
      createdAt: d.createdAt,
      isPublic: 0,
    });
    ctx.report.add('shareLinks.derived');
    return code;
  };
  for (const r of rows) {
    const person = ctx.owners.ownerOf(String(r.owner_id));
    const level = levelOf(r.level, r.role);
    const lastSeen = Number(r.last_seen);
    for (const part of parts) {
      if (person === part.ownerId) continue;
      const code = codeFor(part, level, r.share_code === null ? null : String(r.share_code));
      ctx.sql.index.row({
        table: 'shared_with',
        key: `${person}|${part.id}`,
        columns: ['person_id', 'item_id', 'share_code', 'last_seen'],
        values: [person, part.id, code, lastSeen],
        conflict: ['person_id', 'item_id'],
        version: lastSeen,
        guard: 'last_seen',
        update: ['last_seen'],
      });
      ctx.report.add('sharedWith');
    }
  }
}
