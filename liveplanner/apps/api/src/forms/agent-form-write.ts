// An agent's form write (docs/specs/030-forms/forms.md "Agents", blueprint §15): a Form tab's form replaced whole,
// at the revision the agent read, then relayed to open editors as the `tab-meta` an editor's own edit sends. The tab
// takes the form's heading as its name. While the form takes responses only its settings may change: a form switched
// on but past its Close On or at its Response Limit takes none, so it is not locked (unless the write would open it
// again). A lost race repeats once from the read.
import type { RoomOp } from '@liveplanner/api-schema';
import { tabKindOf, type Tab } from '@liveplanner/project';
import {
  changesBeyondSettings,
  closedBySettings,
  readForm,
  type FormDefinition,
} from '@liveplanner/forms';
import { getLiveFormLink, isTabRevStale, upsertTabAtRev } from '../db';
import { TabTooLargeError } from '../limits';
import { capStoredName } from '../names';
import { relayRoomOps } from '../room-client';
import type { PlanEnv } from '../types';
import { readStoredTab } from '../changesets/stored-tab';
import { SUBMIT_ATTEMPTS } from '../changesets/submit';

const FORM_LOCKED_MESSAGE =
  'This form is taking responses, so only its settings can change. Close it first: its link stays.';

type AgentFormResult = { status: number; body: Record<string, unknown> };

const refused = (status: number, error: string, message: string, extra = {}): AgentFormResult => ({
  status,
  body: { error, message, ...extra },
});

export async function writeAgentForm(
  env: PlanEnv,
  projectId: string,
  tabId: string,
  body: Record<string, unknown>,
): Promise<AgentFormResult> {
  const form = readForm(body['form']);
  if (!form)
    return refused(400, 'invalid_body', '"form" is a form: a heading and sections of questions');
  const theme = body['theme'];
  if (theme !== undefined && !(typeof theme === 'string' && theme.trim() && theme.length <= 64))
    return refused(400, 'invalid_body', '"theme" is a theme id');
  const rev = body['rev'];
  if (rev !== undefined && !(typeof rev === 'number' && Number.isSafeInteger(rev) && rev >= 0))
    return refused(400, 'invalid_body', '"rev" is the tab revision you read');
  const where = { projectId, tabId };
  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
    const stored = await readStoredTab(env, projectId, tabId);
    if (!stored) return refused(404, 'not_found', 'No such tab.');
    if (tabKindOf(stored.tab) !== 'form')
      return refused(400, 'not_a_form_tab', 'That tab holds no form. Add one with add_form.');
    if (stored.tab.locked) return refused(409, 'tab_locked', 'That tab is locked.');
    if (rev !== undefined && rev !== stored.rev) {
      console.info('[forms] agent.changed-since', where);
      return refused(
        409,
        'form_changed',
        `The form changed since you read it (now revision ${stored.rev}). Read it again and redo the change.`,
        { rev: stored.rev },
      );
    }
    const before = readForm(stored.tab.form);
    if (!before || changesBeyondSettings(before, form)) {
      const live = await getLiveFormLink(env, projectId, tabId);
      const now = Date.now();
      const taking = (f: FormDefinition | null): boolean =>
        !f || !closedBySettings(f, { responses: live!.responses, now });
      if (live?.open === 1 && (taking(before) || taking(form))) {
        console.info('[forms] agent.locked', where);
        return refused(409, 'form_locked', FORM_LOCKED_MESSAGE);
      }
    }
    const name = capStoredName(form.heading, null, 'tab');
    // The form wears its tab's look: a theme given is the tab's.
    const next: Tab = {
      ...stored.tab,
      name,
      form,
      ...(typeof theme === 'string' ? { theme } : {}),
    };
    let written: number;
    try {
      written = await upsertTabAtRev(env, projectId, next, stored.orderIndex, stored.rev);
    } catch (err) {
      if (err instanceof TabTooLargeError)
        return refused(413, 'too_large', 'That form is too large.');
      if (isTabRevStale(err)) {
        console.warn('[forms] agent.stale-retry', { ...where, attempt });
        continue;
      }
      throw err;
    }
    const op: RoomOp = {
      kind: 'tab-meta',
      tabId,
      patch: { name, form, ...(typeof theme === 'string' ? { theme } : {}) },
    };
    await relayRoomOps(env, projectId, [op], '[forms] agent');
    console.info('[forms] agent.written', where);
    return { status: 200, body: { tabId, rev: written, name } };
  }
  return refused(
    409,
    'form_changed',
    'The form kept changing while it was written. Read it again.',
  );
}
