// A form's place in liveworkspace's index (docs/specs/030-forms/forms.md "Hearing about responses";
// liveworkspace/docs/one-explorer-contracts.md "What an item pushes"). The plan's Durable Object keeps its form
// links (db/forms.ts); the index keeps, per live link:
//   - its Inbox row (`PUT /app/items/:id/forms/:tabId`): heading, the board its responses land on, how many it has
//     taken and when the last came, and its public code, which is how the Worker finds the plan a code names
//     (`GET /app/forms/:code`, `formPlaceOf`);
//   - how far each reader has seen its responses (`.../seen`), which is the editor's unseen count too.
// A new link's code is registered before the link is answered (`registerFormInbox`, which throws); everything else
// is best effort: a push that fails is logged and never fails the request, and the next response or open sends the
// whole state again.

import { createFormPlaces } from '@liveworkspace/index-app';
import type { CollabFormPlace } from '@liveworkspace/index-client';
import { indexAppClient } from '../index-service';
import type { Env, PlanEnv } from '../types';

type LiveForm = {
  code: string;
  responses: number;
  created_at: number;
  last_response_at: number | null;
  tab_name: string | null;
  heading: string | null;
  board_tab_id: string | null;
};

function liveForm(env: PlanEnv, projectId: string, tabId: string): Promise<LiveForm | null> {
  return env.PLAN_DB.prepare(
    `SELECT code, responses, created_at, last_response_at, tab_name, heading, board_tab_id FROM form_links
      WHERE project_id = ? AND tab_id = ? AND suspended_at IS NULL AND deleted_at IS NULL`,
  )
    .bind(projectId, tabId)
    .first<LiveForm>();
}

async function sendForm(env: PlanEnv, projectId: string, tabId: string): Promise<void> {
  const client = indexAppClient(env);
  if (!client) throw new Error('index_unavailable');
  const form = await liveForm(env, projectId, tabId);
  await client.pushForm(
    projectId,
    tabId,
    form
      ? {
          heading: form.heading || form.tab_name || 'Form',
          boardTabId: form.board_tab_id,
          responses: form.responses,
          latestAt: form.last_response_at ?? form.created_at,
          code: form.code,
        }
      : null,
  );
}

/** A newly published link, on the index before anyone is given its code. Throws when the index refuses or is
 * missing: the caller takes the link back. */
export const registerFormInbox = sendForm;

/** The tab's form as the Inbox lists it, or off the Inbox (and its code with it) when the tab has no live link. */
export async function pushFormInbox(env: PlanEnv, projectId: string, tabId: string): Promise<void> {
  if (!indexAppClient(env)) return;
  try {
    await sendForm(env, projectId, tabId);
  } catch (err) {
    console.warn('[forms] inbox-push-failed', { projectId, err: String(err) });
  }
}

/** The tab's form by its link's code (a response arriving names the code). */
export async function pushFormInboxByCode(env: PlanEnv, code: string): Promise<void> {
  const row = await env.PLAN_DB.prepare('SELECT project_id, tab_id FROM form_links WHERE code = ?')
    .bind(code)
    .first<{ project_id: string; tab_id: string }>()
    .catch(() => null);
  if (row) await pushFormInbox(env, row.project_id, row.tab_id);
}

/** `personId` has seen every response the tab's live form has taken. */
export async function pushFormSeenInbox(
  env: PlanEnv,
  projectId: string,
  tabId: string,
  personId: string,
): Promise<void> {
  const client = indexAppClient(env);
  if (!client) return;
  try {
    const form = await liveForm(env, projectId, tabId);
    if (!form) return;
    await client.pushFormSeen(projectId, tabId, { personId, seen: form.responses });
  } catch (err) {
    console.warn('[forms] inbox-seen-push-failed', { projectId, err: String(err) });
  }
}

/** How many of the live form's `responses` the person has not seen; 0 when the index cannot say. */
export async function unseenFormResponses(
  env: PlanEnv,
  projectId: string,
  tabId: string,
  personId: string,
  responses: number,
): Promise<number> {
  const client = indexAppClient(env);
  if (!client) return 0;
  try {
    return Math.max(0, responses - (await client.formSeen(projectId, tabId, personId)));
  } catch (err) {
    console.warn('[forms] inbox-seen-read-failed', { projectId, err: String(err) });
    return 0;
  }
}

// The Worker's answers for codes, per isolate (@liveworkspace/index-app createFormPlaces).
const formPlaces = createFormPlaces();

/** The plan and tab a public code names, from the index (cached briefly); null for none. Throws when the index
 * cannot answer. */
export async function formPlaceOf(env: Env, code: string): Promise<CollabFormPlace | null> {
  const client = indexAppClient(env);
  if (!client) throw new Error('index_unavailable');
  return formPlaces.lookup(client, code);
}
