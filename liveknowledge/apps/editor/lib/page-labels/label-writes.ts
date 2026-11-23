// Changing the knowledgebase's labels (docs/specs/030-knowledgebase/page-surface.md "Page labels"), apart from React
// so its rules are tested as plain functions: the change judged as the api judges it, shown at once, then stored; on
// a refusal the labels go back to what they were, unless something newer has changed them since. A rename, a new
// colour or a delete is this one write, however many pages carry the label: no page is touched.
import {
  LABEL_REFUSAL_WORDS,
  applyLabelChange,
  parseKnowledgeLabels,
  type KnowledgeLabel,
  type LabelChange,
  type LabelRefusal,
} from '@liveknowledge/document';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { apiCreateLabel, apiDeleteLabel, apiUpdateLabel } from '@/lib/api/knowledge-labels';
import {
  knowledgeSettingsStore,
  type KnowledgeSettingsStore,
} from '@/lib/knowledge-settings/knowledge-settings-store';
import { offlineSaveDocumentMeta } from '@/lib/offline/offline-store';

export type LabelDoors = {
  create: typeof apiCreateLabel;
  update: typeof apiUpdateLabel;
  remove: typeof apiDeleteLabel;
  saveOffline: typeof offlineSaveDocumentMeta;
  store: KnowledgeSettingsStore;
};

export const LABEL_DOORS: LabelDoors = {
  create: apiCreateLabel,
  update: apiUpdateLabel,
  remove: apiDeleteLabel,
  saveOffline: offlineSaveDocumentMeta,
  store: knowledgeSettingsStore,
};

export type LabelTarget = {
  who: KnowledgeCaller;
  documentId: string;
  /** A knowledgebase kept in this browser: the labels are written to its record, and nothing is asked of a server. */
  offline: boolean;
};

/** A change the editor refused before sending it, by the api's own name for it. */
export class LabelRefusedError extends Error {
  readonly refusal: LabelRefusal;
  constructor(refusal: LabelRefusal) {
    super(LABEL_REFUSAL_WORDS[refusal]);
    this.name = 'LabelRefusedError';
    this.refusal = refusal;
  }
}

// `made`: the label as the change settled it (its name trimmed), which is what a new one is sent as.
function send(
  target: LabelTarget,
  change: LabelChange,
  made: KnowledgeLabel | undefined,
  doors: LabelDoors,
): Promise<{ labels: unknown }> {
  const { who, documentId } = target;
  switch (change.kind) {
    case 'add':
      return doors.create(who, documentId, {
        id: change.id,
        name: made!.name,
        colour: made!.colour,
      });
    case 'rename':
      return doors.update(who, documentId, change.id, { name: change.name });
    case 'recolour':
      return doors.update(who, documentId, change.id, { colour: change.colour });
    case 'delete':
      return doors.remove(who, documentId, change.id);
  }
}

/**
 * Apply a change: shown at once (every pill, the picker and the filter follow the store), then stored. Answers the
 * label made or changed (none for a delete). A change the editor can judge is refused before it is sent
 * (LabelRefusedError); a refusal from the server puts the labels back and is thrown for the caller to word.
 */
export async function changeLabels(
  target: LabelTarget,
  change: LabelChange,
  now: number,
  doors: LabelDoors = LABEL_DOORS,
): Promise<KnowledgeLabel | undefined> {
  const { documentId } = target;
  const was = doors.store.labelsOf(documentId);
  const result = applyLabelChange(was, change);
  if ('refusal' in result) throw new LabelRefusedError(result.refusal);
  doors.store.setLabels(documentId, result.labels);
  const shown = doors.store.labelsOf(documentId);
  try {
    if (target.offline)
      await doors.saveOffline(documentId, { knowledgeSettings: { labels: result.labels } }, now);
    else {
      const answer = await send(target, change, result.label, doors);
      doors.store.setLabels(documentId, parseKnowledgeLabels(answer.labels));
    }
    return result.label;
  } catch (err) {
    if (doors.store.labelsOf(documentId) === shown) doors.store.setLabels(documentId, was);
    throw err;
  }
}

/** A failed label change in words: the refusal by name where there is one, else that it could not be saved. */
export function labelFailureText(err: unknown): string {
  const code =
    err instanceof LabelRefusedError ? err.refusal : err instanceof ApiError ? err.code : null;
  if (code && code in LABEL_REFUSAL_WORDS) return LABEL_REFUSAL_WORDS[code as LabelRefusal];
  if (code === 'forbidden') return 'Only an Editor or a Participant can change labels.';
  return 'The label could not be saved. Try again.';
}
