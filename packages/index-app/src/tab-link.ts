// "Add to <Item>": `POST /api/<items>/:target/tabs/:tabId/link {from}` shares a tab of another of the caller's items
// (`from`) into `target` (tab-shares.ts). Both then hold the tab, each its own copy under the same tab id in its own
// Durable Object, and a write to it in either reaches the other. Runs in the target's Durable Object.
//
// Who may: a person who edits BOTH items as one of their own (the owner, or a joined teammate on a team item) — an
// edit grant from the index on each, not one a share link gave, not confined to one tab, and not a workbench session
// (which reaches its one item only). The source half stops anyone grafting in a tab they cannot edit; the target half
// stops anyone putting one into an item they cannot edit. The source's grant is the index's to give: the request
// carries the target's alone.
//
// The app supplies its grants and the two items' rooms; this decides and runs the steps, so the four apps answer
// alike: 400 with no `from` or `from` the target itself, 403 without the access above, 404 for a `from` or tab that
// is not there, 409 when the tab is already held by MAX_TAB_HOLDERS items, and the tab as the target now holds it.

import { MAX_TAB_HOLDERS, type SharedTabCopy } from './tab-shares';

// What a grant says, as an app's route reads it (its own access shape mapped onto this).
export type TabLinkAccess = { level: string; tab: string | null; shareCode: string | null };

// May the caller link tabs into or out of the item they hold `access` on? Full edit access of their own.
export function mayLinkTabs(access: TabLinkAccess | null | undefined): boolean {
  return !!access && access.level === 'edit' && access.shareCode === null && access.tab === null;
}

export type TabLinkInput<T> = {
  targetId: string;
  tabId: string;
  // The request body's `from`, unchecked.
  from: unknown;
  // A workbench session asks: refused.
  workbench: boolean;
  // The caller's access on the target (from the grant the request carried).
  target: TabLinkAccess | null;
  // The caller's access on `from`, from the index: null for none, a Response to return as it is (a refusal the
  // index gave, a password prompt), or 'missing' when there is no such item.
  source: (from: string) => Promise<TabLinkAccess | null | 'missing' | Response>;
  // The tab as the target holds it now (null: not held).
  held: () => Promise<T | null>;
  // The source item's room: the tab and its holders, the join recorded, and how many hold the tab there.
  sourceRoom: (from: string) => {
    sharedTabCopy: (tabId: string) => Promise<SharedTabCopy | null>;
    shareJoined: (tabId: string, member: string, seenUpdatedAt: number) => Promise<boolean>;
  };
  // The target's own step (tab-shares.ts `take`): false when it already holds a tab with that id.
  take: (copy: SharedTabCopy) => Promise<boolean>;
};

export type TabLinkOutcome<T> =
  | { ok: true; tab: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string }
  | { ok: false; response: Response };

export async function linkSharedTab<T>(input: TabLinkInput<T>): Promise<TabLinkOutcome<T>> {
  const { targetId, tabId, from } = input;
  if (input.workbench || !mayLinkTabs(input.target))
    return { ok: false, status: 403, error: 'forbidden' };
  if (typeof from !== 'string' || from.length === 0)
    return { ok: false, status: 400, error: 'from: an item id' };
  if (from === targetId) return { ok: false, status: 400, error: 'from: another item' };
  const source = await input.source(from);
  if (source instanceof Response) return { ok: false, response: source };
  if (source === 'missing') return { ok: false, status: 404, error: 'not_found' };
  if (!mayLinkTabs(source)) return { ok: false, status: 403, error: 'forbidden' };

  // Already here (linked before, or the same id by chance): answered as it is, as a repeat link always was.
  const held = await input.held();
  if (held) return { ok: true, tab: held };
  const room = input.sourceRoom(from);
  const copy = await room.sharedTabCopy(tabId);
  if (!copy) return { ok: false, status: 404, error: 'not_found' };
  // copy.members is every holder but the joining one.
  if (copy.members.length >= MAX_TAB_HOLDERS)
    return { ok: false, status: 409, error: 'too_many_holders' };
  if (!(await input.take(copy))) return { ok: false, status: 404, error: 'not_found' };
  // The holder joined through records the join, tells the rest, and sends the tab again if it changed meanwhile.
  await room.shareJoined(tabId, targetId, copy.updatedAt);
  const tab = await input.held();
  return tab ? { ok: true, tab } : { ok: false, status: 404, error: 'not_found' };
}
