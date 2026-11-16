import type { Element } from '@livedocuments/document';
import { formatResultLines } from '@livedocuments/edit-operations';
import type { AcceptDecide, AcceptWrite } from '@liveworkspace/suggestions/route';
import { lastChangesetRev } from '../db';
import type { DocumentDTO, DocumentEnv } from '../types';
import { afterChangeset } from './after';
import type { FrontDoor } from './front-door';
import { lintResult } from './lint';
import { changesetLog } from './log';
import { readStoredTab } from './stored-tab';
import { SUBMIT_ATTEMPTS, writtenFooter } from './submit';
import { writeChangeset, type Author } from './write';

// Accepting canvas suggestions (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "Reviewing"): what
// the Editor accepted, written to the tab as ONE changeset by them, as a revert is (revert.ts). `decide` is asked
// again on every attempt against the tab as stored, so a lost race re-reads and re-plans.

type AcceptArgs = {
  env: DocumentEnv;
  document: DocumentDTO;
  tabId: string;
  author: Author;
  frontDoor: FrontDoor;
  waitUntil?: (promise: Promise<unknown>) => void;
};

export function acceptWriter(
  args: AcceptArgs,
): (decide: AcceptDecide<Element>) => Promise<AcceptWrite> {
  return async (decide) => {
    const { env, document, tabId } = args;
    const where = { documentId: document.id, tabId };
    for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
      const [stored, prevRev] = await Promise.all([
        readStoredTab(env, document.id, tabId),
        lastChangesetRev(env, tabId),
      ]);
      if (!stored) return { ok: false, status: 404, body: { error: 'not_found' } };
      const plan = decide(stored.tab.elements);
      if (!plan) return { ok: true, changesetId: null };
      const next = { ...stored.tab, elements: plan.elements };
      const lint = lintResult(next, where);
      const outcome = await writeChangeset(env, {
        documentId: document.id,
        tabId,
        stored,
        next,
        orderIndex: stored.orderIndex,
        author: args.author,
        tokenId: null,
        summary: plan.summary,
        baseRev: stored.rev,
        rebasedOver: 0,
        prevRev,
        results: [],
        textFor: (written) =>
          [...formatResultLines([]), writtenFooter(written, document.id, lint)].join('\n'),
        revertOf: null,
      });
      if (outcome.kind === 'stale') {
        changesetLog('warn', '[changeset] lost-race', { ...where, attempt });
        continue;
      }
      if (outcome.kind === 'too_large')
        return { ok: false, status: 413, body: { error: 'too_large' } };
      if (outcome.kind === 'written') {
        args.waitUntil?.(
          afterChangeset.run(env, {
            document,
            author: args.author,
            next,
            stored: stored.tab,
            agent: false,
            frontDoor: args.frontDoor,
            action: 'Applied',
          }),
        );
        return { ok: true, changesetId: outcome.written.id };
      }
      return { ok: true, changesetId: null };
    }
    return {
      ok: false,
      status: 409,
      body: { error: 'tab_busy', message: 'the tab kept changing; try again' },
    };
  };
}
