// POST /api/projects/<id>/tabs/<tabId>/delta: the editor's tab save sent as the element ops since a base copy
// (docs/specs/006-project/delta-saves.md; blueprint "Behaviour and state"). The whole tab is rebuilt from the stored
// copy and the ops, proved by a digest to be exactly the tab the editor holds, and saved through the whole-tab save's
// own path (@liveworkspace/api-kit/tab-delta-door, every product's). Anything that does not line up is refused
// `409 delta_refused`, and the editor saves the tab whole.

import { answerTabDelta } from '@liveworkspace/api-kit/tab-delta-door';
import { applyElementOps, type Element, type ElementOp } from '@liveplanner/project';
import { getTab } from '../db';
import { badRequest, json } from '../responses';
import type { TabSaveProject } from '../db/tab-save-project';
import { readBody, type PlanRouteContext } from './context';
import { writeTabSave } from './tab-put-route';

// The caller has passed the whole-tab save's doors: not a token, and the edit gate for this tab.
export async function handleTabDelta(
  ctx: PlanRouteContext,
  saving: TabSaveProject,
  tabId: string,
  owner: string,
): Promise<Response> {
  const read = await readBody(ctx);
  if (read instanceof Response) return read;
  return answerTabDelta({
    body: read,
    idKey: 'projectId',
    itemId: saving.id,
    tabId,
    readStored: () => getTab(ctx.env, saving.id, tabId),
    apply: (elements: Element[], ops) => applyElementOps(elements, ops as ElementOp[]),
    write: (tab, stored) => writeTabSave(ctx, saving, tabId, owner, tab, { stored }),
    badRequest,
    json,
  });
}
