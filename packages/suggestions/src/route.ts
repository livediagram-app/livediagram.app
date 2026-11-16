// The suggestion routes' rule, the same in every product (liveworkspace/docs/specs/015-suggestions/
// canvas-suggestions.md "The routes" and "Share roles"). Each product's route resolves the caller's level and author,
// the tab and its own element rules, and how an accepted canvas is written (one changeset by the Editor); this
// decides everything else:
//   GET    list    a Participant's or an Editor's; a Viewer sees no suggestion
//   POST   submit  a Participant's or an Editor's; a Viewer can't suggest
//   POST   accept  an Editor's: the named suggestions (or all) as ONE changeset; a stale one is flagged, not applied
//   POST   reject  an Editor's, or its author's own (taking it back)
import { baseOf, opsMismatch, planAccept, type AcceptConflict, type SuggestionModel } from './plan';
import type { SuggestionStore } from './store';
import {
  parseDecision,
  parseSuggestionOps,
  SUGGESTION_MAX_BYTES,
  SUGGESTIONS_MAX_PER_TAB,
  type CanvasSuggestion,
  type SuggestionAuthor,
  type SuggestionElement,
} from './suggestion';

export type SuggestionAction = 'list' | 'submit' | 'accept' | 'reject';
export type SuggestionLevel = 'view' | 'participate' | 'edit';

/** What accepting asks of the product: the canvas to write, given the stored elements, or null for nothing. */
export type AcceptDecide<E extends SuggestionElement> = (
  elements: E[],
) => { elements: E[]; summary: string } | null;

export type AcceptWrite =
  { ok: true; changesetId: string | null } | { ok: false; status: number; body: unknown };

export type SuggestionDoor<E extends SuggestionElement> = {
  level: SuggestionLevel;
  // The caller as its suggestions carry it; null for a caller with no collab key (it may suggest nothing).
  author: SuggestionAuthor | null;
  tabId: string;
  store: SuggestionStore<E>;
  model: SuggestionModel<E>;
  // The product's element validator: the element as stored, or null.
  parseElement: (v: unknown) => E | null;
  // The tab's stored elements, or null when the tab is not there.
  readElements: () => Promise<E[] | null>;
  // Whether a tab holding these elements would still be valid (the product's isValidTab).
  isValid: (elements: E[]) => boolean;
  // Write the accepted canvas as one changeset by the caller, asking `decide` again on every attempt against the
  // stored tab (a lost race re-reads).
  writeAccepted: (decide: AcceptDecide<E>) => Promise<AcceptWrite>;
  // The tab's suggestions changed: tell the room, which tells every Participant and Editor on it.
  changed: () => Promise<void>;
  now: () => number;
  mintId: () => string;
  log: (event: string, fields: Record<string, unknown>) => void;
};

export type SuggestionAnswer = { status: number; body: unknown };

const refuse = (status: number, error: string, message?: string): SuggestionAnswer => ({
  status,
  body: message ? { error, message } : { error },
});

const VIEWER = () => refuse(403, 'viewer_cannot_suggest', 'a Viewer sees and makes no suggestion');
const EDITOR_ONLY = () => refuse(403, 'editor_only', 'only an Editor accepts or rejects');

export async function answerSuggestions<E extends SuggestionElement>(
  action: SuggestionAction,
  body: unknown,
  door: SuggestionDoor<E>,
): Promise<SuggestionAnswer> {
  if (door.level === 'view') return VIEWER();
  if (action === 'list') {
    return { status: 200, body: { suggestions: await door.store.list(door.tabId) } };
  }
  if (action === 'submit') return submit(body, door);
  const decision = parseDecision(body);
  if (!decision) return refuse(400, 'invalid_decision', 'send ids, or all: true');
  const waiting = await door.store.list(door.tabId);
  const picked = 'all' in decision ? waiting : waiting.filter((s) => decision.ids.includes(s.id));
  if (picked.length === 0) return refuse(404, 'not_found');
  return action === 'accept' ? accept(picked, door) : reject(picked, door);
}

async function submit<E extends SuggestionElement>(
  body: unknown,
  door: SuggestionDoor<E>,
): Promise<SuggestionAnswer> {
  if (!door.author) return refuse(403, 'no_collab_key', 'a suggestion needs an author');
  const ops = parseSuggestionOps((body as { ops?: unknown } | null)?.ops, door.parseElement);
  if (!ops.ok) return refuse(400, ops.refusal);
  const elements = await door.readElements();
  if (!elements) return refuse(404, 'not_found');
  const mismatch = opsMismatch(elements, ops.ops);
  if (mismatch) return refuse(409, mismatch, 'the canvas changed; suggest again');
  if (!door.isValid(door.model.apply(elements, ops.ops))) return refuse(422, 'invalid_change');
  const waiting = await door.store.list(door.tabId);
  if (waiting.length >= SUGGESTIONS_MAX_PER_TAB) return refuse(409, 'too_many_suggestions');
  const suggestion: CanvasSuggestion<E> = {
    id: door.mintId(),
    tabId: door.tabId,
    author: door.author,
    createdAt: door.now(),
    ops: ops.ops,
    base: baseOf(elements, ops.ops, door.model.fingerprint),
  };
  if (new TextEncoder().encode(JSON.stringify(suggestion)).length > SUGGESTION_MAX_BYTES)
    return refuse(413, 'too_large');
  await door.store.put(suggestion);
  door.log('[suggestion] made', { tabId: door.tabId, ops: ops.ops.length });
  await door.changed();
  return { status: 201, body: { suggestion } };
}

async function accept<E extends SuggestionElement>(
  picked: CanvasSuggestion<E>[],
  door: SuggestionDoor<E>,
): Promise<SuggestionAnswer> {
  if (door.level !== 'edit') return EDITOR_ONLY();
  // The plan the last attempt wrote: a lost race asks again against the tab as it then is.
  let accepted: string[] = [];
  let conflicts: AcceptConflict[] = [];
  const written = await door.writeAccepted((elements) => {
    const plan = planAccept(elements, picked, door.model);
    accepted = plan.accepted;
    conflicts = plan.conflicts;
    if (plan.accepted.length === 0) return null;
    const n = plan.accepted.length;
    return {
      elements: plan.elements,
      summary: n === 1 ? 'Accepted a suggestion' : `Accepted ${n} suggestions`,
    };
  });
  if (!written.ok) return { status: written.status, body: written.body };
  await door.store.remove(accepted);
  for (const c of conflicts) {
    const s = picked.find((p) => p.id === c.id)!;
    await door.store.put({ ...s, conflict: c.elements });
  }
  door.log('[suggestion] accepted', {
    tabId: door.tabId,
    accepted: accepted.length,
    conflicts: conflicts.length,
  });
  await door.changed();
  if (accepted.length === 0) {
    return {
      status: 409,
      body: {
        error: 'suggestion_conflict',
        message: 'the canvas changed since; nothing was applied',
        conflicts,
      },
    };
  }
  return { status: 200, body: { accepted, conflicts, changeset: written.changesetId } };
}

async function reject<E extends SuggestionElement>(
  picked: CanvasSuggestion<E>[],
  door: SuggestionDoor<E>,
): Promise<SuggestionAnswer> {
  // A Participant takes back only its own.
  if (door.level !== 'edit' && !picked.every((s) => s.author.key === door.author?.key))
    return EDITOR_ONLY();
  const ids = picked.map((s) => s.id);
  await door.store.remove(ids);
  door.log('[suggestion] rejected', { tabId: door.tabId, rejected: ids.length });
  await door.changed();
  return { status: 200, body: { rejected: ids } };
}
