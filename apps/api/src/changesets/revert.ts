import type { ElementOp } from '@livediagram/document';
import type { RevertResponse } from '@livediagram/api-schema';
import { formatResultLines } from '@livediagram/edit-operations';
import { getChangesetPart, lastChangesetRev, type ChangesetRecord } from '../db';
import { readRoomSelections } from '../room-client';
import { personTagFor } from '../person-tag';
import type { DocumentDTO, Env } from '../types';
import { afterChangeset } from './after';
import type { FrontDoor } from './front-door';
import { heldTargets } from './held-check';
import { lintResult } from './lint';
import { changesetLog } from './log';
import { planRevert } from './revert-plan';
import { readStoredTab } from './stored-tab';
import { SUBMIT_ATTEMPTS, writtenFooter, type SubmitResult } from './submit';
import { writeChangeset, type Author } from './write';

// A revert (docs/specs/024-agents/agent-changesets.md "Revert"): the changeset's inverse applied as
// a new changeset by the reverter, leaving every element changed since and listing it as kept.
// Anyone with edit access to the tab may revert; a person's revert is never held, a token's is.

export type RevertArgs = {
  env: Env;
  document: DocumentDTO;
  record: ChangesetRecord;
  author: Author;
  tokenId: string | null;
  frontDoor: FrontDoor;
  waitUntil?: (promise: Promise<unknown>) => void;
};

export async function revertChangeset(args: RevertArgs): Promise<SubmitResult> {
  const { env, document, record } = args;
  const where = { documentId: document.id, tabId: record.tabId, changesetId: record.id };
  const [opsPart, inversePart] = await Promise.all([
    getChangesetPart(env, record.id, 'ops'),
    getChangesetPart(env, record.id, 'inverse'),
  ]);
  if (opsPart === null || inversePart === null)
    return { status: 404, body: { error: 'not_found' } };
  const ops = JSON.parse(opsPart) as ElementOp[];
  const inverse = JSON.parse(inversePart) as ElementOp[];
  for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
    const [stored, prevRev] = await Promise.all([
      readStoredTab(env, document.id, record.tabId),
      lastChangesetRev(env, record.tabId),
    ]);
    // The tab left the document since: nothing here to revert.
    if (!stored) return { status: 404, body: { error: 'not_found' } };
    const plan = planRevert(stored.tab, ops, inverse, record.fingerprints);
    if (args.tokenId) {
      const tag = await personTagFor(document.id, args.author.id);
      const selections = await readRoomSelections(env, document.id, record.tabId, tag);
      const touched = ops.flatMap((op) =>
        op.kind === 'remove' ? [op.id] : op.kind === 'reorder' ? [] : [op.element.id],
      );
      const held = heldTargets(touched, selections);
      if (held.length > 0) {
        changesetLog('info', '[changeset] held', { ...where, held: held.length });
        return { status: 409, body: { error: 'elements_held', held } };
      }
    }
    const next = { ...stored.tab, elements: plan.elements };
    const lint = lintResult(next, where);
    const outcome = await writeChangeset(env, {
      documentId: document.id,
      tabId: record.tabId,
      stored,
      next,
      orderIndex: stored.orderIndex,
      author: args.author,
      tokenId: args.tokenId,
      summary: null,
      baseRev: stored.rev,
      rebasedOver: 0,
      prevRev,
      results: [],
      textFor: (written) =>
        [...formatResultLines([]), writtenFooter(written, document.id, lint)].join('\n'),
      revertOf: record.id,
    });
    if (outcome.kind === 'stale') {
      changesetLog('warn', '[changeset] lost-race', { ...where, attempt });
      continue;
    }
    if (outcome.kind === 'too_large') return { status: 413, body: { error: 'too_large' } };
    const changeset = outcome.kind === 'written' ? outcome.written : null;
    changesetLog('info', '[changeset] reverted', {
      ...where,
      revertOf: record.id,
      reverted: plan.reverted,
      kept: plan.kept.length,
    });
    if (changeset) {
      args.waitUntil?.(
        afterChangeset.run(env, {
          document,
          author: args.author,
          next: { ...stored.tab, elements: plan.elements },
          stored: stored.tab,
          // The Agent·Reverted event counts reverts of an agent's changeset, whoever reverts it.
          agent: record.tokenId !== null,
          frontDoor: args.frontDoor,
          action: 'Reverted',
        }),
      );
    }
    const body: RevertResponse = {
      changeset,
      reverted: plan.reverted,
      kept: plan.kept,
      lint: changeset ? lint : null,
    };
    return { status: 200, body };
  }
  return { status: 409, body: { error: 'tab_busy', message: 'the tab kept changing; try again' } };
}
