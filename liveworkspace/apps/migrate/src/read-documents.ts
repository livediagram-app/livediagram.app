// Reads the old documents out of a snapshot, one at a time, as the splitter takes them (OldDocumentInput): the
// `documents` row, its tabs through `document_tabs` in order, its Plan rows, its agent changesets and its image
// grants. Raw rows, never through livediagram's read path (docs/migration.md, rules). Streamed in id order: one
// document's rows are in memory at a time, each read on its table's index.
import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type {
  MigrationChangeset,
  MigrationPlanData,
  OldDocumentInput,
} from '@liveworkspace/migration';

/** What the index needs of a document beyond what the splitter takes. */
export type DocumentExtra = {
  folderId: string | null;
  /** The folder's team, when the folder exists (null for a person's folder). */
  folderTeamId: string | null | undefined;
  trashReason: string | null;
  sharePassword: string | null;
};

export type OldDocument = { input: OldDocumentInput; extra: DocumentExtra };

type Row = Record<string, string | number | null>;

const scalar = (v: unknown): string =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : JSON.stringify(v);
const str = (v: unknown): string | null => (v === null || v === undefined ? null : scalar(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : typeof v === 'number' ? v : Number(v);

export class DocumentReader {
  private readonly tabs: StatementSync;
  private readonly items: StatementSync;
  private readonly sheets: StatementSync;
  private readonly cells: StatementSync;
  private readonly forms: StatementSync;
  private readonly changesets: StatementSync;
  private readonly parts: StatementSync;
  private readonly grants: StatementSync;
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.tabs = db.prepare(
      `SELECT dt.tab_id, dt.order_index, dt.added_at, dt.folder, t.name, t.data, t.updated_at, t.element_count
         FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
        WHERE dt.document_id = ? ORDER BY dt.order_index, dt.tab_id`,
    );
    this.items = db.prepare(
      `SELECT id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by
         FROM items WHERE document_id = ? ORDER BY item_key, id`,
    );
    this.sheets = db.prepare(
      `SELECT id, tab_id, title, layout, rev, created_at, updated_at, updated_by
         FROM sheets WHERE document_id = ? ORDER BY id`,
    );
    this.cells = db.prepare(
      `SELECT sheet_id, row_id, col_id, input, format
         FROM sheet_cells WHERE document_id = ? ORDER BY sheet_id, row_id, col_id`,
    );
    this.forms = db.prepare(
      `SELECT code, tab_id, open, created_at, responses, last_response_at, deleted_at
         FROM form_links WHERE document_id = ? ORDER BY code`,
    );
    this.changesets = db.prepare(
      `SELECT id, tab_id, rev, base_rev, author_id, author_name, author_color, token_id, summary, fingerprints,
              added, changed, removed, created_tab, revert_of, created_at
         FROM agent_changesets WHERE document_id = ? ORDER BY created_at, id`,
    );
    this.parts = db.prepare(
      `SELECT part, data FROM agent_changeset_parts WHERE changeset_id = ? ORDER BY part`,
    );
    this.grants = db.prepare(
      `SELECT image_id, created_at FROM image_grants WHERE document_id = ? ORDER BY image_id`,
    );
    // Everyone who may have written the document's cards or sheets: its team, the people it was shared with or
    // opened by, and its changesets' authors (each on its own index).
    this.people = db.prepare(
      `SELECT user_id AS id FROM team_members WHERE team_id = ?2 AND user_id IS NOT NULL
       UNION SELECT owner_id FROM shared_with WHERE document_id = ?1
       UNION SELECT owner_id FROM document_opens WHERE document_id = ?1
       UNION SELECT owner_id FROM favourites WHERE document_id = ?1
       UNION SELECT author_id FROM agent_changesets WHERE document_id = ?1`,
    );
  }

  private readonly people: StatementSync;

  private peopleOf(id: string, ownerId: string, teamId: string | null, hasPlan: boolean): string[] {
    // Only Plan rows carry people to recompute; a document without them needs nobody.
    if (!hasPlan) return [ownerId];
    const found = new Set<string>([ownerId]);
    for (const r of this.people.all(id, teamId ?? '') as { id: string | null }[]) {
      if (r.id) found.add(r.id);
    }
    return [...found].sort();
  }

  /** Every document, in id order. */
  *all(): Generator<OldDocument> {
    const docs = this.db.prepare(
      `SELECT d.*, f.id AS folder_found, f.team_id AS folder_team
         FROM documents d LEFT JOIN folders f ON f.id = d.folder_id
        ORDER BY d.id`,
    );
    for (const row of docs.iterate() as Iterable<Row>) yield this.read(row);
  }

  private byId: StatementSync | null = null;

  /** One document by id, or undefined. */
  one(id: string): OldDocument | undefined {
    this.byId ??= this.db.prepare(
      `SELECT d.*, f.id AS folder_found, f.team_id AS folder_team
         FROM documents d LEFT JOIN folders f ON f.id = d.folder_id WHERE d.id = ?`,
    );
    const row = this.byId.get(id) as Row | undefined;
    return row ? this.read(row) : undefined;
  }

  /** Each document's id with its tabs' raw bodies, in id order: what the first pass needs, and nothing more. */
  *tabBodies(): Generator<{ id: string; bodies: string[] }> {
    const rows = this.db.prepare(
      `SELECT d.id AS id, t.data AS data
         FROM documents d
         LEFT JOIN document_tabs dt ON dt.document_id = d.id
         LEFT JOIN tabs t ON t.id = dt.tab_id
        ORDER BY d.id`,
    );
    let current: { id: string; bodies: string[] } | null = null;
    for (const r of rows.iterate() as Iterable<{ id: string; data: string | null }>) {
      if (current && current.id !== r.id) {
        yield current;
        current = null;
      }
      current ??= { id: r.id, bodies: [] };
      if (r.data !== null) current.bodies.push(r.data);
    }
    if (current) yield current;
  }

  private read(d: Row): OldDocument {
    const id = String(d.id);
    const input: OldDocumentInput = {
      document: {
        id,
        ownerId: String(d.owner_id),
        name: String(d.name ?? ''),
        teamId: str(d.team_id),
        source: str(d.source),
        presentation: str(d.presentation),
        savedAt: num(d.saved_at),
        createdAt: num(d.created_at),
        trashedAt: numOrNull(d.trashed_at),
        opensIn: str(d.opens_in),
        tabKind: str(d.tab_kind),
        templateFamily: str(d.template_family),
      },
      tabs: (this.tabs.all(id) as Row[]).map((t) => ({
        id: String(t.tab_id),
        name: String(t.name ?? ''),
        data: String(t.data ?? '{}'),
        updatedAt: num(t.updated_at),
        orderIndex: num(t.order_index),
        addedAt: num(t.added_at),
        folder: str(t.folder),
        elementCount: numOrNull(t.element_count),
      })),
      plan: this.plan(id, d),
      changesets: this.changesetsOf(id),
      imageGrants: (this.grants.all(id) as Row[]).map((g) => ({
        imageId: String(g.image_id),
        createdAt: num(g.created_at),
      })),
    };
    input.people = this.peopleOf(
      id,
      input.document.ownerId,
      input.document.teamId,
      input.plan !== null,
    );
    return {
      input,
      extra: {
        folderId: d.folder_found === null ? null : str(d.folder_id),
        folderTeamId: d.folder_found === null ? undefined : str(d.folder_team),
        trashReason: str(d.trash_reason),
        sharePassword: str(d.share_password),
      },
    };
  }

  private plan(id: string, d: Row): MigrationPlanData | null {
    const items = this.items.all(id) as Row[];
    const sheets = this.sheets.all(id) as Row[];
    const forms = this.forms.all(id) as Row[];
    const itemTypes = str(d.item_types);
    if (items.length === 0 && sheets.length === 0 && forms.length === 0 && itemTypes === null) {
      return null;
    }
    return {
      itemTypes,
      itemTypesRev: num(d.item_types_rev),
      itemsRev: num(d.items_rev),
      itemsNextKey: num(d.items_next_key),
      items: items.map((r) => ({
        id: String(r.id),
        type: String(r.type),
        itemKey: num(r.item_key),
        rank: String(r.rank),
        fields: String(r.fields),
        rev: num(r.rev),
        createdAt: num(r.created_at),
        updatedAt: num(r.updated_at),
        createdBy: str(r.created_by),
        updatedBy: str(r.updated_by),
      })),
      sheets: sheets.map((r) => ({
        id: String(r.id),
        tabId: String(r.tab_id),
        title: String(r.title),
        layout: String(r.layout),
        rev: num(r.rev),
        createdAt: num(r.created_at),
        updatedAt: num(r.updated_at),
        updatedBy: str(r.updated_by),
      })),
      cells:
        sheets.length === 0
          ? []
          : (this.cells.all(id) as Row[]).map((r) => ({
              sheetId: String(r.sheet_id),
              rowId: String(r.row_id),
              colId: String(r.col_id),
              input: str(r.input),
              format: str(r.format),
            })),
      formLinks: forms.map((r) => ({
        code: String(r.code),
        tabId: String(r.tab_id),
        open: num(r.open),
        createdAt: num(r.created_at),
        responses: num(r.responses),
        lastResponseAt: numOrNull(r.last_response_at),
        deletedAt: numOrNull(r.deleted_at),
      })),
    };
  }

  private changesetsOf(id: string): MigrationChangeset[] {
    return (this.changesets.all(id) as Row[]).map((c) => ({
      id: String(c.id),
      tabId: String(c.tab_id),
      rev: num(c.rev),
      // The old column allows null (a changeset from before base revisions were kept): read as 0, "unknown".
      baseRev: num(c.base_rev),
      authorId: str(c.author_id),
      authorName: str(c.author_name),
      authorColor: str(c.author_color),
      tokenId: str(c.token_id),
      summary: str(c.summary),
      fingerprints: str(c.fingerprints),
      added: num(c.added),
      changed: num(c.changed),
      removed: num(c.removed),
      createdTab: num(c.created_tab),
      revertOf: str(c.revert_of),
      createdAt: num(c.created_at),
      parts: (this.parts.all(String(c.id)) as Row[]).map((p) => ({
        part: String(p.part) as 'ops' | 'inverse' | 'results',
        data: String(p.data),
      })),
    }));
  }
}
