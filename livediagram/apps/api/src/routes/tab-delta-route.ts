// POST /api/documents/<id>/tabs/<tabId>/delta: the editor's tab save sent as the element ops since a base copy
// (docs/specs/006-document/delta-saves.md; blueprint "Behaviour and state"). The whole tab is rebuilt from the stored
// copy and the ops, proved by a digest to be exactly the tab the editor holds, and saved through the whole-tab save's
// own path. Anything that does not line up is refused `409 delta_refused`, and the editor saves the tab whole.

import {
  TAB_DELTA_MAX_OPS,
  TAB_DELTA_REFUSED,
  elementsDigest,
  parseTabDelta,
  type TabDeltaRefusal,
} from '@liveworkspace/api-schema/tab-delta';
import { applyElementOps, type ElementOp } from '@livediagram/document';
import { getTab } from '../db';
import { badRequest, json } from '../responses';
import type { TabSaveDocument } from '../db/tab-save-document';
import { readBody, type DocumentRouteContext } from './context';
import { writeTabSave } from './tab-put-route';

// The caller has passed the whole-tab save's doors: not a token, and the edit gate for this tab.
export async function handleTabDelta(
  ctx: DocumentRouteContext,
  saving: TabSaveDocument,
  tabId: string,
  owner: string,
): Promise<Response> {
  const documentId = saving.id;
  const read = await readBody(ctx);
  if (read instanceof Response) return read;
  const delta = parseTabDelta(read);
  if (typeof delta === 'string') return badRequest(delta);
  const refuse = (reason: TabDeltaRefusal) => {
    console.info('[tab-delta] refused', { documentId, tabId, reason });
    return json({ error: TAB_DELTA_REFUSED, reason }, { status: 409 });
  };
  if (delta.ops.length > TAB_DELTA_MAX_OPS) return refuse('too_many_ops');
  const stored = await getTab(ctx.env, documentId, tabId);
  if (!stored) return refuse('no_base');
  if (stored.rev !== delta.baseRev) return refuse('stale_base');
  // The ops' elements are the editor's as sent; the schema gate in writeTabSave checks them once rebuilt.
  const elements = applyElementOps(stored.elements, delta.ops as unknown as ElementOp[]);
  if ((await elementsDigest(elements)) !== delta.digest) return refuse('digest_mismatch');
  const saved = await writeTabSave(
    ctx,
    saving,
    tabId,
    owner,
    { ...delta.tab, id: tabId, elements },
    { stored },
  );
  if (saved instanceof Response) return saved;
  const digest = await elementsDigest(saved.elements);
  console.info('[tab-delta] saved', {
    documentId,
    tabId,
    ops: delta.ops.length,
    matched: digest === delta.digest,
  });
  return json({ rev: saved.tab.rev, digest });
}
