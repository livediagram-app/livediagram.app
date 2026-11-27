// A page's people as a Viewer reads them (docs/specs/013-workspace/share-roles.md "Ids a Viewer sees", Work Tracker
// 1479). A page's knowledge fields name people: its owner, who verified it, and who asked for and decided its
// approval. The shared rule (@liveworkspace/api-kit/hidden-people) leaves them be, since a Viewer has to see who they
// are, so here each id a Viewer is handed becomes a stand-in: one-way, the same for one person across one
// knowledgebase (salted with its id, so it names nobody anywhere else), and the key Page Health's names are given
// under. The Viewer sees the name, never the id.
//
// Pure, over plain JSON, and the same reference back whenever nothing changes, so a caller can skip a re-serialise.

import { sha256HexSync } from '@liveworkspace/api-schema/sha256';
import {
  isPersonIdShape,
  ownIdIs,
  sessionIsViewer,
  type IsOwnId,
} from '@liveworkspace/api-kit/hidden-people';

/** What every stand-in starts with: a hidden person's mark (`isHiddenPerson`), never an id's shape. */
export const PERSON_TOKEN_PREFIX = 'hidden-p';
const TOKEN_HEX = 16;

/** Whether a value is a stand-in `personToken` wrote. */
export const isPersonToken = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith(PERSON_TOKEN_PREFIX);

const TOKEN_CACHE_MAX = 512;
const tokens = new Map<string, string>();

/**
 * The stand-in for `id` in the knowledgebase `documentId`. Remembered for the ids a room keeps seeing, at most
 * TOKEN_CACHE_MAX (each entry two short strings), the oldest going first.
 */
export function personToken(documentId: string, id: string): string {
  const key = `${documentId}\u0000${id}`;
  const known = tokens.get(key);
  if (known !== undefined) return known;
  const hex = sha256HexSync(
    new TextEncoder().encode(`liveknowledge:person:v1:${documentId}:${id}`),
  ).slice(0, TOKEN_HEX);
  const token = `${PERSON_TOKEN_PREFIX}${hex}`;
  if (tokens.size >= TOKEN_CACHE_MAX) tokens.delete(tokens.keys().next().value!);
  tokens.set(key, token);
  return token;
}

/** How one reader sees a person's id: as it is, or as its stand-in. */
export type SeePerson = (id: string) => string;

/** A Viewer's view of ids: their own and anything not id-shaped (a guest's `guest:<name>` Verify) as it is. */
export function viewerSeer(documentId: string, isOwn: IsOwnId): SeePerson {
  return (id) => (isPersonIdShape(id) && !isOwn(id) ? personToken(documentId, id) : id);
}

/**
 * The seer for a reader holding a grant at `role`: null for a Participant and an Editor (and the owner, whose grant
 * is an Editor's), who read every id; a Viewer's otherwise, keeping `caller`'s own.
 */
export function seerFor(
  role: string | null | undefined,
  caller: string | null,
  documentId: string,
): SeePerson | null {
  return sessionIsViewer(role) ? viewerSeer(documentId, ownIdIs(caller)) : null;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function seenFields(obj: Json, fields: readonly string[], see: SeePerson): Json {
  let out: Json | null = null;
  for (const f of fields) {
    const v = obj[f];
    if (typeof v !== 'string') continue;
    const next = see(v);
    if (next !== v) (out ??= { ...obj })[f] = next;
  }
  return out ?? obj;
}

const PAGE_PEOPLE = ['owner', 'verifiedBy'] as const;
const APPROVAL_PEOPLE = ['requestedBy', 'decidedBy'] as const;

/** A page's knowledge fields (stored, or as Page Health answers them) with each person seen by `see`. */
export function knowledgeSeen<T>(knowledge: T, see: SeePerson): T {
  if (!isObject(knowledge)) return knowledge;
  let out = seenFields(knowledge, PAGE_PEOPLE, see);
  const approval = knowledge.approval;
  if (isObject(approval)) {
    const next = seenFields(approval, APPROVAL_PEOPLE, see);
    if (next !== approval) out = { ...out, approval: next };
  }
  return out as T;
}

/** A tab (or a tab's summary) with its knowledge fields seen by `see`. */
export function tabSeen<T>(tab: T, see: SeePerson): T {
  if (!isObject(tab) || !isObject(tab.knowledge)) return tab;
  const next = knowledgeSeen(tab.knowledge, see);
  return next === tab.knowledge ? tab : { ...tab, knowledge: next };
}

/** A knowledgebase's read with every page summary's knowledge fields seen by `see`. */
export function documentSeen<T extends { tabs: readonly unknown[] }>(doc: T, see: SeePerson): T {
  let tabs: unknown[] | null = null;
  doc.tabs.forEach((t, i) => {
    const next = tabSeen(t, see);
    if (next !== t) (tabs ??= doc.tabs.slice())[i] = next;
  });
  return tabs ? { ...doc, tabs } : doc;
}

/**
 * A room op as a Viewer's socket receives it: a `tab` op's tab and a `tab-meta` op's patch with the page's people
 * seen. Every other op (none carries a page's knowledge) is passed at once.
 */
export function opSeen(op: unknown, see: SeePerson): unknown {
  if (!isObject(op)) return op;
  if (op.kind === 'tab') {
    const tab = tabSeen(op.tab, see);
    return tab === op.tab ? op : { ...op, tab };
  }
  if (op.kind === 'tab-meta') {
    const patch = tabSeen(op.patch, see);
    return patch === op.patch ? op : { ...op, patch };
  }
  return op;
}

function restoreFields(incoming: Json, stored: unknown, fields: readonly string[]): Json {
  let out: Json | null = null;
  const from = isObject(stored) ? stored : {};
  for (const f of fields) {
    if (!isPersonToken(incoming[f])) continue;
    out ??= { ...incoming };
    const original = from[f];
    if (typeof original === 'string' && !isPersonToken(original)) out[f] = original;
    else delete out[f];
  }
  return out ?? incoming;
}

/**
 * A tab being written with every stand-in in its knowledge fields put back from `stored`, the tab it replaces: a
 * write made from a Viewer's copy never stores a stand-in nor loses an id. A stand-in with nothing stored behind it
 * goes (and an approval left without its asker with it, as `parseApproval` would drop it). The same tab back when its
 * knowledge holds none, which is every write but one made from a Viewer's copy.
 */
export function restoreKnowledgePeople<T>(incoming: T, stored: unknown): T {
  if (!isObject(incoming) || !isObject(incoming.knowledge)) return incoming;
  const knowledge = incoming.knowledge;
  const was = isObject(stored) && isObject(stored.knowledge) ? stored.knowledge : {};
  let next = restoreFields(knowledge, was, PAGE_PEOPLE);
  const approval = knowledge.approval;
  if (isObject(approval)) {
    const restored = restoreFields(approval, was.approval, APPROVAL_PEOPLE);
    if (restored !== approval) {
      next = { ...next };
      if (typeof restored.requestedBy === 'string') next.approval = restored;
      else delete next.approval;
    }
  }
  return next === knowledge ? incoming : { ...incoming, knowledge: next };
}
