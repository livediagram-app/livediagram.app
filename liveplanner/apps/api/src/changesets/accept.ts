import type { Element } from '@liveplanner/project';
import { formatResultLines } from '@liveplanner/edit-operations';
import type { AcceptDecide, AcceptWrite } from '@liveworkspace/suggestions/route';
import { lastChangesetRev } from '../db';
import type { ProjectDTO, PlanEnv } from '../types';
import { afterChangeset } from './after';
import type { FrontDoor } from './front-door';
import { changesetLog } from './log';
import { readStoredTab } from './stored-tab';
import { SUBMIT_ATTEMPTS, writtenFooter } from './submit';
import { writeChangeset, type Author } from './write';

// Accepting canvas suggestions (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Reviewing"): what
// the Editor accepted, written to the tab as ONE changeset by them, as a revert is (revert.ts). `decide` is asked
// again on every attempt against the tab as stored, so a lost race re-reads and re-plans.

type AcceptArgs = {
  env: PlanEnv;
  project: ProjectDTO;
  tabId: string;
  author: Author;
  frontDoor: FrontDoor;
  waitUntil?: (promise: Promise<unknown>) => void;
};

export function acceptWriter(
  args: AcceptArgs,
): (decide: AcceptDecide<Element>) => Promise<AcceptWrite> {
  return async (decide) => {
    const { env, project, tabId } = args;
    const where = { projectId: project.id, tabId };
    for (let attempt = 1; attempt <= SUBMIT_ATTEMPTS; attempt += 1) {
      const [stored, prevRev] = await Promise.all([
        readStoredTab(env, project.id, tabId),
        lastChangesetRev(env, tabId),
      ]);
      if (!stored) return { ok: false, status: 404, body: { error: 'not_found' } };
      const plan = decide(stored.tab.elements);
      if (!plan) return { ok: true, changesetId: null };
      const next = { ...stored.tab, elements: plan.elements };
      const outcome = await writeChangeset(env, {
        projectId: project.id,
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
          [...formatResultLines([]), writtenFooter(written, project.id)].join('\n'),
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
            project,
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
