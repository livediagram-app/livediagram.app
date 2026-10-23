// /api/internal/items/**: the liveworkspace index's doors into a canvas's content (docs/specs/015-api/api.md
// "Internal"), answered by the shared kit (@liveworkspace/index-app handleInternalItems): the bearer check against
// INDEX_KEY, the paths and their bodies. This file only says what each door does to a canvas: each is one call to
// the canvas's Durable Object (document-client.ts) or the person's own stores, and a copy also carries the image grants the source held
// (docs/specs/009-elements/images.md "Placement grants").
import { handleInternalItems as handle } from '@liveworkspace/index-app';
import { imageGrantCopyStatements } from '../db/image-grants';
import { documentRoom } from '../document-client';
import { copyImageIds } from '../document-room/document-content';
import { personStore } from '../person-client';
import { workbenchStore } from '../workbench-store';
import type { Env } from '../types';

export function handleInternalItems(
  request: Request,
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void = (p) => void p,
): Promise<Response> {
  return handle(request, {
    key: env.INDEX_KEY,
    waitUntil,
    handlers: {
      purge: (id) => documentRoom(env, id).purge(),
      revoke: (id, codes) => documentRoom(env, id).revokeCodes(codes),
      copy: async (from, to, tabId) => {
        const copy = await documentRoom(env, from).exportCopy(tabId, null);
        // No such canvas, or no such tab in it.
        if (!copy || (tabId && copy.tabs.length === 0)) return 'not_found';
        // The target is a new canvas: importCopy is one transaction, so a copy into one that already holds this
        // content fails its keys and writes nothing (the kit answers 409).
        await documentRoom(env, to).importCopy(copy);
        const grants = imageGrantCopyStatements(env, from, to, copyImageIds(copy), Date.now());
        if (grants.length > 0) await env.DB.batch(grants);
        return { tabs: copy.tabs.length, items: 0 };
      },
      // A closed account, wherever it was closed: what livediagram keeps for them in their own stores. Their
      // workbench (pairings, tickets and sessions, whose rooms it closes) and their shape libraries.
      personClosed: async (personId) => {
        await workbenchStore(env, personId).close();
        await personStore(env, personId).purge();
      },
    },
  });
}
