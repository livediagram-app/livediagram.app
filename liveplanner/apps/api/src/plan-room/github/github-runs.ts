// A linked pull request starting the plan's Automations (docs/specs/026-plan/github-pull-requests.md "GitHub
// triggers"; blueprint "Part 4"): one `github` event per linked card, queued for the room's alarm as any trigger is.
// Only when some rule that is on hears GitHub (the same in-memory check every write makes), so a plan with no GitHub
// rule runs no statement. A run's id is the event's and the rule's, and the event's is the delivery's and the card's:
// a redelivery GitHub makes runs nothing twice (and the plan's `firstSight` already stops it before it gets here).
import {
  GITHUB_PERSON,
  RULE_MOVES_MAX,
  type AutomationEvent,
  type GithubHeard,
} from '@liveplanner/items';
import type { PlanEnv } from '../../types';
import { enqueueStatement } from '../automations/automation-queue';

/** Whether any rule of the plan hears GitHub. */
export const hearsGithub = (env: Pick<PlanEnv, 'AUTOMATIONS'>): boolean =>
  env.AUTOMATIONS?.kinds.has('github') === true;

/** The runs `heard` starts on `cardIds` (at most RULE_MOVES_MAX), queued; answers how many went in. */
export async function queueGithubRuns(
  env: Pick<PlanEnv, 'PLAN_DB' | 'AUTOMATIONS'>,
  heard: GithubHeard,
  pr: string,
  cardIds: readonly string[],
  deliveryId: string,
  now: number,
): Promise<number> {
  const hook = env.AUTOMATIONS;
  if (!hook?.kinds.has('github') || cardIds.length === 0) return 0;
  const events: AutomationEvent[] = [...new Set(cardIds)]
    .slice(0, RULE_MOVES_MAX)
    .map((cardId) => ({
      id: `g:${deliveryId}:${cardId}`,
      kind: 'github',
      cardId,
      by: GITHUB_PERSON,
      role: 'system',
      github: heard,
      pr,
      at: now,
    }));
  try {
    const res = await enqueueStatement(env.PLAN_DB, events, now).run();
    const queued = Number(res.meta.changes ?? 0);
    hook.queued(events.length - queued);
    console.info('[github] runs', { heard, queued });
    return queued;
  } catch (error) {
    console.warn('[github] runs.failed', { error: String(error) });
    return 0;
  }
}
