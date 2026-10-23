// /api/internal/items/**: the One Explorer index's doors into a plan's content (docs/specs/015-api/api.md
// "Internal"), served by @liveworkspace/index-app's handleInternalItems with the app's key (INDEX_KEY). See it for
// the doors: a purge (one plan, or up to a hundred for a closed account), revoked links, notices for the emails,
// and a copy into a new plan.
//
// Each is a call to the plan's Durable Object (plan-client.ts). Where the plan is filed, its sharing and its
// Trash are the index's; a purge also drops what the api keeps about the plan beside it (db/projects.ts
// `purgePlanRows`). A notice is worked out off the index's path: a share link made (the first-share milestone),
// or someone's first time in through a link (the owner's "someone joined" email).
import { handleInternalItems as handle } from '@liveworkspace/index-app';
import { notifyFirstShare } from '../email/notifications';
import { purgePlanRows } from '../db/projects';
import { planRoom } from '../plan-client';
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
      purge: async (id) => {
        await planRoom(env, id).purge();
        await purgePlanRows(env, id);
      },
      // A rescoped link (another level or tab) reloads its visitors into what it now opens; a revoked one sends
      // them away.
      revoke: (id, codes, reason) => planRoom(env, id).revokeCodes(codes, reason),
      notice: (id, notice) =>
        notice.type === 'shared'
          ? notifyFirstShare(env, notice.actorId)
          : planRoom(env, id).joined(notice.personId),
      // A closed account: their name off each plan of someone else's that names them. What liveplanner keeps
      // for them beside their plans goes with their account (routes/account.ts).
      anonymise: (id, personId) => planRoom(env, id).anonymise(personId),
      copy: async (from, to, tabId) => {
        const copy = await planRoom(env, from).exportCopy(tabId, null);
        // No such plan, or no such tab in it.
        if (!copy || (tabId && copy.tabs.length === 0)) return 'not_found';
        // The target is a new plan: a copy into one that already holds this content fails its keys, and nothing
        // is written (importCopy is one transaction); the kit answers that as a conflict.
        await planRoom(env, to).importCopy(copy);
        return { tabs: copy.tabs.length, items: copy.items.length };
      },
    },
  });
}
