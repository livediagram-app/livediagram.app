// A form's place in liveworkspace's Inbox (docs/specs/030-forms/forms.md "Hearing about responses";
// liveworkspace/docs/one-explorer-contracts.md "What an item pushes"): its live link's heading, the board its
// responses land on, how many it has taken and when the last came (`PUT /app/items/:id/forms/:tabId`), and how far
// each reader has seen them (`.../seen`). Pushed when a response lands, the form is published, deleted or renamed,
// and a reader opens it. Best effort: a push that fails is logged and never fails the request; the next response
// or open sends the whole state again.

import { indexAppClient } from '../index-service';
import type { Env } from '../types';

type LiveForm = {
  responses: number;
  created_at: number;
  last_response_at: number | null;
  tab_name: string | null;
  heading: string | null;
  board_tab_id: string | null;
};

function liveForm(env: Env, projectId: string, tabId: string): Promise<LiveForm | null> {
  return env.DB.prepare(
    `SELECT responses, created_at, last_response_at, tab_name, heading, board_tab_id FROM form_links
      WHERE project_id = ? AND tab_id = ? AND suspended_at IS NULL AND deleted_at IS NULL`,
  )
    .bind(projectId, tabId)
    .first<LiveForm>();
}

/** The tab's form as the Inbox lists it, or off the Inbox when the tab has no live link. */
export async function pushFormInbox(env: Env, projectId: string, tabId: string): Promise<void> {
  const client = indexAppClient(env);
  if (!client) return;
  try {
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
          }
        : null,
    );
  } catch (err) {
    console.warn('[forms] inbox-push-failed', { projectId, err: String(err) });
  }
}

/** The tab's form by its link's code (a response arriving names the code). */
export async function pushFormInboxByCode(env: Env, code: string): Promise<void> {
  const row = await env.DB.prepare('SELECT project_id, tab_id FROM form_links WHERE code = ?')
    .bind(code)
    .first<{ project_id: string; tab_id: string }>()
    .catch(() => null);
  if (row) await pushFormInbox(env, row.project_id, row.tab_id);
}

/** `personId` has seen every response the tab's live form has taken. */
export async function pushFormSeenInbox(
  env: Env,
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
