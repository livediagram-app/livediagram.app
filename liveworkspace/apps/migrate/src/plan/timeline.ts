// The old Timeline into the index's (docs/migration.md, step 2: "History is kept"): each old event with its
// original time, its actor through the owner map, and `detail: {"imported":"1"}`, so the import reads as history,
// never as fresh activity, and nobody is notified (the index notifies on its own writes, not on these rows).
// - A document's event goes on the part that kept the document's id (events are about documents, not tabs).
// - A team's or token's event is an account event, under the platform's app (`liveworkspace`), no item.
// - A document taken offline is the person's own event (`taken_offline`), about no item, titled with its name.
// - A kind the index has under another name is mapped to it (visitors' opens and copies, syncs, accepted invitations,
//   a member leaving as `team_member_removed` marked `left`).
// - An old event kind with no new equivalent is counted in the report and dropped, never guessed.
// Each event is written once under `imp:<old id>` and never updated: history doesn't change.
import type { PlanContext } from './context.ts';

type Row = Record<string, string | number | null>;

// Old event types (after the old site's own renames: diagram_* became document_*) to the index's.
const ITEM_TYPES: Readonly<Record<string, string>> = {
  document_created: 'created',
  document_duplicated: 'created',
  document_imported: 'created',
  document_renamed: 'renamed',
  document_moved: 'moved',
  document_trashed: 'trashed',
  document_restored: 'restored',
  document_shared: 'shared',
  document_unshared: 'unshared',
  document_favourited: 'favourited',
  document_edited: 'edited',
  document_updated: 'edited',
  share_link_created: 'shared',
  comment_added: 'commented',
  comment_resolved: 'comment_resolved',
  action_assigned: 'action_assigned',
  action_completed: 'action_done',
  document_synced: 'synced',
  document_opened_by_visitor: 'opened_by_visitor',
  document_copied_by_visitor: 'copied_by_visitor',
};
const ACCOUNT_TYPES: Readonly<Record<string, string>> = {
  team_invite_sent: 'team_invite_sent',
  team_member_invited: 'team_invite_sent',
  team_joined: 'team_joined',
  team_member_joined: 'team_joined',
  team_invite_accepted: 'team_joined',
  team_declined: 'team_declined',
  team_invite_declined: 'team_declined',
  team_role_changed: 'team_role_changed',
  team_member_role_changed: 'team_role_changed',
  team_member_removed: 'team_member_removed',
  team_member_left: 'team_member_removed',
  team_renamed: 'team_renamed',
  team_deleted: 'team_deleted',
  token_created: 'token_created',
  token_revoked: 'token_revoked',
  token_expiring: 'token_expiring',
  token_expiry_warning: 'token_expiring',
};
// A person's own event, about no item: the app it happened in. A document taken offline left the server, so its event
// names no item, only the document's name as it was.
const PERSON_TYPES: Readonly<Record<string, string>> = {
  image_uploaded: 'image_uploaded',
  document_offline: 'taken_offline',
};

// The index's detail beside the import mark, where its card reads one: a member who left says so (`left`), with
// their team and name, which the old snapshot kept.
function detailOf(oldType: string, snapshot: Record<string, unknown>): string {
  if (oldType !== 'team_member_left') return IMPORTED;
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, TITLE_MAX) : null);
  return JSON.stringify({
    imported: '1',
    left: '1',
    teamId: text(snapshot.teamId),
    memberName: text(snapshot.memberName),
  });
}

const IMPORTED = JSON.stringify({ imported: '1' });
const TITLE_MAX = 200;

function parse(text: unknown): Record<string, unknown> {
  try {
    const v = JSON.parse(typeof text === 'string' ? text : '{}') as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function writeTimeline(ctx: PlanContext): void {
  const events = ctx.snapshot.prepare('SELECT * FROM timeline_events ORDER BY occurred_at, id');
  const scopes = ctx.snapshot.prepare(
    'SELECT scope_type, scope_id FROM timeline_event_scopes WHERE event_id = ? AND deleted_at IS NULL ORDER BY scope_type, scope_id',
  );
  const teamTitle = ctx.snapshot.prepare('SELECT name FROM teams WHERE id = ?');
  for (const e of events.iterate() as Iterable<Row>) {
    const oldType = String(e.event_type);
    const sourceType = String(e.source_type);
    const sourceId = String(e.source_id);
    const itemType = ITEM_TYPES[oldType];
    const accountType = ACCOUNT_TYPES[oldType];
    const personType = PERSON_TYPES[oldType];
    const snapshot = parse(e.snapshot);
    const actorOld = e.actor_id === null ? null : String(e.actor_id);
    const actor = actorOld ? ctx.owners.ownerOf(actorOld) : null;
    // A visitor's events kept their name as `visitorName`.
    const named = snapshot.actorName ?? snapshot.visitorName;
    const actorName = typeof named === 'string' ? named.slice(0, TITLE_MAX) : null;
    let app: string;
    let itemId: string | null = null;
    let type: string;
    let title: string;
    const found = new Set<string>();
    const kept = sourceType === 'document' ? ctx.kept.get(sourceId) : undefined;
    if (itemType && sourceType === 'document') {
      if (!kept) {
        ctx.report.dropHistory(`${oldType} (document not copied)`);
        continue;
      }
      app = kept.app;
      itemId = sourceId;
      type = itemType;
      title = kept.title;
      found.add(kept.scope);
    } else if (accountType) {
      app = 'liveworkspace';
      type = accountType;
      const team =
        sourceType === 'team'
          ? (teamTitle.get(sourceId) as { name: string } | undefined)?.name
          : undefined;
      const named =
        team ??
        (typeof snapshot.name === 'string' ? snapshot.name : null) ??
        e.description ??
        e.title;
      title = String(named ?? '').slice(0, TITLE_MAX);
    } else if (personType && actor) {
      app = 'livediagram';
      type = personType;
      const documentName =
        typeof snapshot.documentName === 'string' ? snapshot.documentName : e.description;
      title = String(oldType === 'document_offline' ? (documentName ?? e.title) : e.title).slice(
        0,
        TITLE_MAX,
      );
      found.add(`p:${actor}`);
    } else {
      ctx.report.dropHistory(oldType);
      continue;
    }
    for (const s of scopes.all(String(e.id)) as Row[]) {
      const id = String(s.scope_id);
      if (s.scope_type === 'user') found.add(`p:${ctx.owners.ownerOf(id)}`);
      else if (s.scope_type === 'team') found.add(`t:${id}`);
      else if (s.scope_type === 'document' && kept) found.add(kept.scope);
    }
    if (found.size === 0) {
      ctx.report.dropHistory(`${oldType} (no one sees it)`);
      continue;
    }
    const id = `imp:${String(e.id)}`;
    const at = Number(e.occurred_at);
    ctx.sql.index.row({
      table: 'timeline_events',
      key: id,
      columns: [
        'id',
        'app',
        'item_id',
        'actor_id',
        'actor_name',
        'type',
        'title',
        'detail',
        'occurred_at',
      ],
      values: [id, app, itemId, actor, actorName, type, title, detailOf(oldType, snapshot), at],
      conflict: ['id'],
      version: 1,
    });
    for (const scope of [...found].sort()) {
      ctx.sql.index.row({
        table: 'timeline_event_scopes',
        key: `${scope}|${id}`,
        columns: ['scope', 'event_id', 'app', 'occurred_at'],
        values: [scope, id, app, at],
        conflict: ['scope', 'event_id'],
        version: 1,
      });
    }
    ctx.report.add(`timeline.${type}`);
  }
}
