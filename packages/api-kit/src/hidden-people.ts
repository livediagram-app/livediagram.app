// The ids a Viewer is not handed (each product's docs/specs/013-workspace/share-roles.md "Ids a Viewer sees", Work
// Tracker 1451). A share-link Viewer reads names, never other people's account or guest ids: an id ties the person to
// every other liveworkspace item they touch, and a guest's id is the one their api calls carry. One rule for every
// product, applied wherever a Viewer is handed tab content: the tab read (and the views and MCP reads built on it),
// the comment list, a copy, and every op frame the realtime room sends a Viewer's socket.
//
// Three passes, all pure and over plain JSON, so any element kind or room op that carries a person is covered by its
// field name, whatever the product:
//
// - hidePeople: the Viewer's copy. A person field (`userId`, `memberId`, `assignerId`, `componentEditBy`) reads
//   HIDDEN_PERSON unless it is the Viewer's own id. A key field (`participantId`, `startedBy`, `voter`, `voters`,
//   `votes`) normally holds a collab key, an adder key or a Q&A voter hash, which give nothing away, and passes;
//   only an entry from before those keys existed that holds an account or guest id reads `hidden-<n>`, numbered so a
//   count or a "one per person" stays right.
// - copyWithoutPeople: a copy's tab, which keeps nothing to restore from: person fields are cleared (an assignee id
//   null, an assigner '', the rest removed) and id-shaped key entries read `someone-<n>`, a neutral key of nobody.
// - restoreHiddenPeople: a whole-tab save. Every hidden value is put back from the stored tab it was hidden from
//   (objects matched by key, list entries by `id`), so a save from a Viewer's copy never wipes an id; one with
//   nothing stored to come from is cleared, so the sentinel itself is never stored.

import { sha256HexSync } from '@liveworkspace/api-schema/sha256';
import { COLLAB_KEY_LENGTH } from '@liveworkspace/api-schema/collab-key';

/** What a hidden person field reads. Not an id's shape, so it never matches anyone. */
export const HIDDEN_PERSON = 'hidden';
const HIDDEN_ENTRY = 'hidden-';
const NEUTRAL_ENTRY = 'someone-';

/** Fields whose string value always names a person: an account, guest or team membership id. */
const PERSON_FIELDS: ReadonlySet<string> = new Set([
  'userId',
  'memberId',
  'assignerId',
  'componentEditBy',
]);
/** Fields holding one person's key: hidden only when the key is an account or guest id. */
const KEY_FIELDS: ReadonlySet<string> = new Set(['participantId', 'startedBy', 'voter']);
/** Fields holding a list of keys (Q&A voters). */
const KEY_LIST_FIELDS: ReadonlySet<string> = new Set(['voters']);
/** Fields holding lists of keys by element id (a dot vote's `votes`). */
const KEY_RECORD_FIELDS: ReadonlySet<string> = new Set(['votes']);

/** Whether a value is one of the placeholders hidePeople writes. */
export function isHiddenPerson(value: unknown): value is string {
  return typeof value === 'string' && (value === HIDDEN_PERSON || value.startsWith(HIDDEN_ENTRY));
}

/** Whether a value is an account id (`user_…`) or a guest id (`guest_…`). */
export function isPersonIdShape(value: unknown): value is string {
  return typeof value === 'string' && (value.startsWith('user_') || value.startsWith('guest_'));
}

/** Whether an id is the reader's own, which they keep. */
export type IsOwnId = (id: string) => boolean;

/** No id is the reader's own: a reader with no identity. */
export const NOBODY: IsOwnId = () => false;

/** The reader's own id: the tab read's caller. */
export const ownIdIs =
  (caller: string | null): IsOwnId =>
  (id) =>
    caller !== null && id === caller;

/** Whether a grant's level reads every id: a Participant's or an Editor's. Anything else (a Viewer) does not. */
const readsIds = (role: string | null | undefined): boolean =>
  role === 'participate' || role === 'edit';

/**
 * `value` as a reader holding a grant at `role` is handed it: as it is for a Participant or an Editor, and with people
 * hidden (keeping `caller`'s own id) for a Viewer. The owner's grant is an Editor's.
 */
export function peopleForReader<T>(value: T, role: string | null | undefined, caller: string | null): T {
  return readsIds(role) ? value : hidePeople(value, ownIdIs(caller));
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null;

type Mode = 'hide' | 'copy';

class Hider {
  private n = 0;
  private readonly isOwn: IsOwnId;
  private readonly mode: Mode;
  constructor(isOwn: IsOwnId, mode: Mode) {
    this.isOwn = isOwn;
    this.mode = mode;
  }

  private entry(): string {
    this.n += 1;
    return `${this.mode === 'hide' ? HIDDEN_ENTRY : NEUTRAL_ENTRY}${this.n}`;
  }

  private key(v: unknown): unknown {
    return isPersonIdShape(v) && !this.isOwn(v) ? this.entry() : v;
  }

  private keyList(list: unknown): unknown {
    if (!Array.isArray(list)) return list;
    let out: unknown[] | null = null;
    for (let i = 0; i < list.length; i++) {
      const next = this.key(list[i]);
      if (next !== list[i]) (out ??= list.slice())[i] = next;
    }
    return out ?? list;
  }

  private keyRecord(record: unknown): unknown {
    if (!isObject(record) || Array.isArray(record)) return record;
    let out: Json | null = null;
    for (const k in record) {
      const next = this.keyList(record[k]);
      if (next !== record[k]) (out ??= { ...record })[k] = next;
    }
    return out ?? record;
  }

  walk(v: unknown): unknown {
    if (Array.isArray(v)) {
      let out: unknown[] | null = null;
      for (let i = 0; i < v.length; i++) {
        const item = v[i];
        if (!isObject(item)) continue;
        const next = this.walk(item);
        if (next !== item) (out ??= v.slice())[i] = next;
      }
      return out ?? v;
    }
    if (!isObject(v)) return v;
    let out: Json | null = null;
    const set = (k: string, next: unknown) => {
      out ??= { ...v };
      if (next === undefined) delete out[k];
      else out[k] = next;
    };
    for (const k in v) {
      const value = v[k];
      if (PERSON_FIELDS.has(k)) {
        if (typeof value === 'string' && value !== '' && !this.isOwn(value)) {
          const next = this.mode === 'hide' ? HIDDEN_PERSON : cleared(k);
          if (next !== value) set(k, next);
        }
      } else if (KEY_FIELDS.has(k)) {
        const next = this.key(value);
        if (next !== value) set(k, next);
      } else if (KEY_LIST_FIELDS.has(k)) {
        const next = this.keyList(value);
        if (next !== value) set(k, next);
      } else if (KEY_RECORD_FIELDS.has(k)) {
        const next = this.keyRecord(value);
        if (next !== value) set(k, next);
      } else if (isObject(value)) {
        const next = this.walk(value);
        if (next !== value) set(k, next);
      }
    }
    return out ?? v;
  }
}

// A person field with nothing to restore it from: an assignee's account id null (the type's "not yet known"), an
// assigner '' (the Community's anonymous assigner), and anything else gone.
function cleared(field: string): unknown {
  if (field === 'userId') return null;
  if (field === 'assignerId') return '';
  return undefined;
}

/**
 * `value` as a Viewer reads it: every person field that is not `isOwn` reads HIDDEN_PERSON, and every key entry that
 * is an account or guest id reads `hidden-<n>`. The same reference back when nothing names anyone else, so the
 * caller can skip a re-serialise.
 */
export function hidePeople<T>(value: T, isOwn: IsOwnId): T {
  return new Hider(isOwn, 'hide').walk(value) as T;
}

/** `value` as a copy made by anyone but the owner carries it: nobody's ids but the copier's, nothing to restore. */
export function copyWithoutPeople<T>(value: T, isOwn: IsOwnId): T {
  return new Hider(isOwn, 'copy').walk(value) as T;
}

/** A stored tab's `data` JSON as copyWithoutPeople leaves it; data that does not parse is returned as it is. */
export function copyDataWithoutPeople(data: string, isOwn: IsOwnId): string {
  if (!mayNamePeople(data)) return data;
  try {
    const parsed: unknown = JSON.parse(data);
    const next = copyWithoutPeople(parsed, isOwn);
    return next === parsed ? data : JSON.stringify(next);
  } catch {
    return data;
  }
}

// Whether serialised JSON could hold a person: a person field's name, or an id's prefix. A cheap scan with no
// repetition in it, so the common frame (a cursor, a move) is passed on without being parsed or walked.
const NAMES_PEOPLE = /"(?:userId|memberId|assignerId|componentEditBy)"|user_|guest_/;

/** Whether serialised JSON may hold an id hidePeople would hide. False means it certainly holds none. */
export function mayNamePeople(serialized: string): boolean {
  return NAMES_PEOPLE.test(serialized);
}

// ---------- The room ---------------------------------------------------------------------------------------------

// One entry: a broadcast tests the same serialised frame once per Viewer socket.
let lastScanned: string | null = null;
let lastScan = false;

/**
 * The frame a Viewer's socket receives for an op frame (`{ kind: 'op', op, ... }`): the op with people hidden, or the
 * serialised frame itself when it names nobody. Any other frame passes.
 */
export function frameForViewer(
  payload: { kind: string; op?: unknown },
  serialized: string,
  isOwn: IsOwnId,
): string {
  if (payload.kind !== 'op') return serialized;
  if (serialized !== lastScanned) {
    lastScanned = serialized;
    lastScan = mayNamePeople(serialized);
  }
  if (!lastScan) return serialized;
  const op = hidePeople(payload.op, isOwn);
  return op === payload.op ? serialized : JSON.stringify({ ...payload, op });
}

const OWN_KEY_CACHE_MAX = 512;
const collabKeys = new Map<string, string>();

// The collab key of an id, as collabKeyFor derives it, at once (the room's frames cannot wait for Web Crypto).
// Remembered for the ids a room keeps seeing, at most OWN_KEY_CACHE_MAX (safe range 64 to 4096: each entry is two
// short strings), the oldest going first.
function collabKeyOf(id: string): string {
  const known = collabKeys.get(id);
  if (known !== undefined) return known;
  const key = sha256HexSync(new TextEncoder().encode(`liveworkspace:collab:v1:${id}`)).slice(
    0,
    COLLAB_KEY_LENGTH,
  );
  if (collabKeys.size >= OWN_KEY_CACHE_MAX) collabKeys.delete(collabKeys.keys().next().value!);
  collabKeys.set(id, key);
  return key;
}

/**
 * A room session's own ids: the room holds no account or guest id, only the collab key derived from it, so an id is
 * the session's own when it derives the same key. Only an id's shape is hashed; nothing else can be anyone's.
 */
export function ownIdsOfCollabKey(collabKey: string | null | undefined): IsOwnId {
  if (!collabKey) return NOBODY;
  return (id) => isPersonIdShape(id) && collabKeyOf(id) === collabKey;
}

/**
 * Whether a room session reads as a Viewer: anything below Participant, a session from before the role stamp
 * included (it reads as a Viewer's everywhere else too), and never the owner.
 */
export function sessionIsViewer(role: string | null | undefined, isOwner = false): boolean {
  return !isOwner && !readsIds(role);
}

/** What a room session's attachment says of it, as far as this rule reads. */
export type ViewerSession = {
  verifiedRole?: string | null;
  isOwner?: boolean;
  collabKey?: string | null;
};

/**
 * A room session's own ids when it is a Viewer's, whose frames hide everyone else; null for a Participant, an Editor
 * or the owner, whose frames pass as they are. A socket with no session yet reads as a Viewer with no id.
 */
export function viewerOwnIds(session: ViewerSession | null | undefined): IsOwnId | null {
  if (session && !sessionIsViewer(session.verifiedRole, session.isOwner)) return null;
  return ownIdsOfCollabKey(session?.collabKey);
}

// ---------- Restore on save ------------------------------------------------------------------------------------------

// Whether anything in `v` is a placeholder hidePeople wrote. Reads only, so a save with none (every save but one from
// a Viewer's copy) costs one walk and nothing else.
function holdsHidden(v: unknown): boolean {
  if (Array.isArray(v)) {
    for (const item of v) if (isObject(item) ? holdsHidden(item) : isHiddenPerson(item)) return true;
    return false;
  }
  if (!isObject(v)) return false;
  for (const k in v) {
    const value = v[k];
    if (isObject(value)) {
      if (holdsHidden(value)) return true;
    } else if (isHiddenPerson(value) && (PERSON_FIELDS.has(k) || KEY_FIELDS.has(k))) return true;
  }
  return false;
}

// A list of keys with its hidden entries put back: the hidden ones go, and every stored entry they stood for (an
// account or guest id, or an earlier placeholder) not already in the list comes back.
function restoreKeyList(incoming: unknown[], stored: unknown): unknown[] {
  if (!incoming.some(isHiddenPerson)) return incoming;
  const kept = incoming.filter((k) => !isHiddenPerson(k));
  const have = new Set(kept);
  const back = Array.isArray(stored)
    ? stored.filter((k) => (isPersonIdShape(k) || isHiddenPerson(k)) && !have.has(k))
    : [];
  return [...kept, ...back];
}

// A list of answers keyed by `participantId` (responses), the same way.
function restoreAnswerList(incoming: Json[], stored: unknown): unknown[] {
  if (!incoming.some((r) => isHiddenPerson(r.participantId))) return incoming;
  const kept = incoming.filter((r) => !isHiddenPerson(r.participantId));
  const have = new Set(kept.map((r) => r.participantId));
  const back = Array.isArray(stored)
    ? stored.filter(
        (r) =>
          isObject(r) &&
          (isPersonIdShape(r.participantId) || isHiddenPerson(r.participantId)) &&
          !have.has(r.participantId),
      )
    : [];
  return [...kept, ...back];
}

function restoreArray(incoming: unknown[], stored: unknown): unknown[] {
  if (incoming.length > 0 && incoming.every((x) => isObject(x) && 'participantId' in x))
    return restoreAnswerList(incoming as Json[], stored);
  const storedList = Array.isArray(stored) ? stored : [];
  // Lists of things with ids (elements, actions, comments, notes) match by id, so a list reordered or grown since
  // the read still finds each one's stored self; anything else matches by position.
  const byId = new Map<unknown, unknown>();
  for (const s of storedList) if (isObject(s) && typeof s.id === 'string') byId.set(s.id, s);
  let out: unknown[] | null = null;
  for (let i = 0; i < incoming.length; i++) {
    const item = incoming[i];
    if (!isObject(item)) continue;
    const from = typeof item.id === 'string' ? byId.get(item.id) : storedList[i];
    const next = restoreValue(item, from);
    if (next !== item) (out ??= incoming.slice())[i] = next;
  }
  return out ?? incoming;
}

function restoreValue(incoming: unknown, stored: unknown): unknown {
  if (Array.isArray(incoming)) return restoreArray(incoming, stored);
  if (!isObject(incoming) || !holdsHidden(incoming)) return incoming;
  const from: Json = isObject(stored) && !Array.isArray(stored) ? stored : {};
  const out: Json = { ...incoming };
  for (const k in incoming) {
    const value = incoming[k];
    if ((PERSON_FIELDS.has(k) || KEY_FIELDS.has(k)) && isHiddenPerson(value)) {
      const original = from[k];
      const next =
        typeof original === 'string' && !isHiddenPerson(original) ? original : cleared(k);
      if (next === undefined) delete out[k];
      else out[k] = next;
    } else if (KEY_LIST_FIELDS.has(k) && Array.isArray(value)) {
      out[k] = restoreKeyList(value, from[k]);
    } else if (KEY_RECORD_FIELDS.has(k) && isObject(value) && !Array.isArray(value)) {
      const storedRecord = isObject(from[k]) ? (from[k] as Json) : {};
      const record: Json = {};
      for (const id in value) {
        const list = value[id];
        record[id] = Array.isArray(list) ? restoreKeyList(list, storedRecord[id]) : list;
      }
      out[k] = record;
    } else if (isObject(value)) {
      out[k] = restoreValue(value, from[k]);
    }
  }
  return out;
}

/**
 * A whole-tab save (or any write that replaces content whole) with every placeholder hidePeople wrote put back from
 * `stored`, the content it replaces: a save made from a Viewer's copy never wipes an id. A placeholder with nothing
 * stored behind it is cleared. The same reference back when the save holds no placeholder, which is every save but
 * one made from a Viewer's copy.
 */
export function restoreHiddenPeople<T>(incoming: T, stored: unknown): T {
  if (!holdsHidden(incoming)) return incoming;
  return restoreValue(incoming, stored) as T;
}
