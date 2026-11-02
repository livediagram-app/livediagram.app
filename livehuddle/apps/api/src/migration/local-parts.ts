// A browser's This Browser document moved by product (docs/migration.md step 6 "Local only documents";
// docs/specs/015-api/api.md "Migration"): the editor's one-time pass sends a local document's raw record; this splits
// it (@liveworkspace/migration splitLocalDocument) with livehuddle's hooks, keeps nothing, and hands each other app's
// part to the index (`POST /app/migration/handoff`, as the caller), which makes the item for them and writes it
// through that app's migration door. What stays livehuddle's goes back to the browser as `keep`, raw.
//
// Safe to send again: every part's id (and every tab id the split makes) is a hash of the caller, the local document
// and the part, so a retry after a lost answer names the same items, and the index's 409 `item_exists` for one counts
// as landed. A handoff that fails partway answers 502 with the parts that did land, so the editor keeps its local copy
// whole and tries again.

import { splitLocalDocument as split } from '@liveworkspace/migration/split';
import { sha256HexPrefix } from '@liveworkspace/migration/sha256';
import type {
  HandoffRequest,
  LocalDocumentInput,
  LocalPartsAnswer,
  MigrationApp,
  MigrationRoomPayload,
  SplitHooks,
} from '@liveworkspace/migration';
import {
  INDEX_APP_HEADER,
  INDEX_PERSON_HEADER,
  INDEX_TEAMS_HEADER,
} from '@liveworkspace/index-client';
import { APP_ITEMS, APP_SITES } from '@liveworkspace/sites';
import { indexApiUrl } from '../index-service';
import { capStoredName } from '../names';
import type { Env } from '../types';
import { pageRectsOf } from './page-rects';
import { upgradeStoredTabKeepingRetired } from './upgrade-tab';

export type Part = LocalPartsAnswer['parts'][number];

// A part's (or a split tab's) id: UUID-shaped (version 5 and RFC variant bits set) from the caller and the
// splitter's seed (`<local document id>:<app>`, or `<local document id>:<tab id>:<family>` for a tab), so the same
// caller sending the same document makes the same ids every time, and two callers never share one.
export function localPartId(callerId: string, seed: string): string {
  const hex = sha256HexPrefix(`livehuddle-local-part:${callerId}:${seed}`, 16).split('');
  hex[12] = '5';
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Where an app opens one of its items, from the site list (@liveworkspace/sites): the editor's link to the part.
export function partUrl(app: MigrationApp, id: string, tabId: string | null = null): string {
  const items = APP_ITEMS[app];
  const site = APP_SITES.find((s) => s.id === items.site)!;
  const tab = tabId ? `#t=${encodeURIComponent(tabId)}` : '';
  return `${site.url}${items.itemPath}${encodeURIComponent(id)}${tab}`;
}

// livehuddle's side of the split, for one caller. `imageOwner` answers null for every image: a browser's own
// record is no proof of whose an image is, so a part claims no owner and no grant for any (the target app asks the
// media service, and serves only its owner's own), and nobody can make a part serve an image they could not.
export function localPartsHooks(callerId: string): SplitHooks {
  return {
    newId: (seed) => localPartId(callerId, seed),
    ownerOf: () => callerId,
    upgradeTab: upgradeStoredTabKeepingRetired,
    pageRects: pageRectsOf,
    imageOwner: () => null,
    partUrl,
  };
}

export type HandoffOutcome = 'landed' | 'failed';

// One part to the index as the caller (the delegated mode, livehuddle's key): it makes the item and calls that app's
// migration door with its INDEX_KEY. A part already made (409 `item_exists`, a retry) has landed.
export async function handOffPart(
  env: Env,
  callerId: string,
  part: MigrationRoomPayload,
): Promise<HandoffOutcome> {
  const base = indexApiUrl(env);
  if (!base || !env.INDEX_KEY || part.app === 'livediagram') return 'failed';
  const body: HandoffRequest = { app: part.app, title: part.name, payload: part };
  let res: Response;
  try {
    res = await fetch(`${base}/app/migration/handoff`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.INDEX_KEY}`,
        [INDEX_APP_HEADER]: 'livehuddle',
        [INDEX_PERSON_HEADER]: callerId,
        [INDEX_TEAMS_HEADER]: '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[migration] handoff unreachable', { app: part.app, error: String(err) });
    return 'failed';
  }
  if (res.ok) return 'landed';
  const error = ((await res.json().catch(() => null)) as { error?: unknown } | null)?.error;
  if (res.status === 409 && error === 'item_exists') return 'landed';
  console.warn('[migration] handoff refused', { app: part.app, status: res.status, error });
  return 'failed';
}

export type LocalPartsResult =
  | { status: 200; body: LocalPartsAnswer }
  // Some parts did not land: what did, so nothing is dropped from the browser.
  | { status: 502; body: { error: 'handoff_failed'; parts: Part[] } };

export type LocalPartsDeps = {
  split: typeof split;
  handOff: typeof handOffPart;
};

// Split one local document for the caller and hand its parts off, one after another (a document has at most three
// other parts). Each part's title is the document's name as the target app stores it.
export async function moveLocalParts(
  env: Env,
  callerId: string,
  input: LocalDocumentInput,
  deps: LocalPartsDeps = { split, handOff: handOffPart },
): Promise<LocalPartsResult> {
  const result = deps.split(input, localPartsHooks(callerId));
  for (const note of result.notes) console.info('[migration] local split', { note });
  const landed: Part[] = [];
  let failed = false;
  for (const payload of result.parts) {
    // The split sets these from the hooks; set again here so no browser field can change whose a part is.
    const part: MigrationRoomPayload = {
      ...payload,
      ownerId: callerId,
      teamId: null,
      name: capStoredName(payload.name, null, 'document') || 'Untitled',
      imageOwners: [],
      imageGrants: [],
      changesets: [],
    };
    if ((await deps.handOff(env, callerId, part)) === 'failed') {
      failed = true;
      continue;
    }
    landed.push({
      app: part.app,
      id: part.id,
      url: partUrl(part.app, part.id),
      tabIds: part.tabs.map((t) => t.id),
    });
  }
  console.info('[migration] local parts', { parts: result.parts.length, landed: landed.length });
  if (failed) return { status: 502, body: { error: 'handoff_failed', parts: landed } };
  return { status: 200, body: { parts: landed, keep: result.keep } };
}
