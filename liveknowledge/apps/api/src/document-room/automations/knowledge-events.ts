// A knowledgebase's own triggers' moments, queued where they happen (docs/specs/013-workspace/automations.md
// "Triggers of its own"; blueprint automations.md "Event call sites"): Page Verified and Page Owner Changed from a
// fields save, Unanswered Question from the question log, Pages Disagree from the conflict check, Agent Suggested a
// Change from a suggestion. Each asks the engine first whether a rule that is on hears the kind (one Set lookup) and
// reads nothing more when none does. Review Due is review-events.ts.
import {
  OTHER_PAGE_DATA,
  OWNER_CHANGED_EVENT,
  PAGES_DISAGREE_EVENT,
  PAGE_VERIFIED_EVENT,
  QUESTION_DATA,
  QUESTION_UNANSWERED_EVENT,
  SUGGESTION_ADDED_EVENT,
  SUGGESTION_REASON_DATA,
} from '@liveknowledge/document/automations';
import type { KnowledgeFields } from '@liveknowledge/knowledge';
import type { Conflict } from '@liveknowledge/knowledge';
import { queueEvent, type ItemHost } from '@liveworkspace/automations/room';
import type { VersionWho } from './version-events';

type Host = Pick<ItemHost, 'AUTOMATIONS'>;

// Who made a knowledge change: a person, an agent by its token's name, or a rule's own step.
export type KnowledgeWho = VersionWho;

/** Whether a rule that is on hears `kind`. */
export const hearsKnowledge = (host: Host, kind: string): boolean =>
  host.AUTOMATIONS?.kinds.has(kind) === true;

/** A fields save landed: Page Verified when it verified the page, Page Owner Changed when its owner moved. `who`
 *  is asked only when a rule hears one of them. */
export async function queueFieldsChanged(
  host: Host,
  input: {
    tab: string;
    before: KnowledgeFields;
    after: KnowledgeFields;
    who: () => Promise<KnowledgeWho>;
  },
): Promise<void> {
  const { tab, before, after } = input;
  const verifiedNow =
    after.verifiedAt !== undefined &&
    after.verifiedAt !== before.verifiedAt &&
    hearsKnowledge(host, PAGE_VERIFIED_EVENT);
  const ownerMoved =
    (after.owner ?? '') !== (before.owner ?? '') && hearsKnowledge(host, OWNER_CHANGED_EVENT);
  if (!verifiedNow && !ownerMoved) return;
  const who = await input.who();
  const at = Date.now();
  if (verifiedNow)
    queueEvent(host, {
      id: `verified:${tab}:${after.verifiedAt}`,
      kind: PAGE_VERIFIED_EVENT,
      at,
      tab,
      ...who,
    });
  if (ownerMoved)
    queueEvent(host, {
      id: `owner:${tab}:${at}`,
      kind: OWNER_CHANGED_EVENT,
      at,
      tab,
      ...who,
    });
}

/** Unanswered Question: each group of like questions `fresh` names (logged for the first time), once. */
export function queueUnanswered(
  host: Host,
  fresh: readonly { key: string; question: string }[],
  who: KnowledgeWho | null,
): void {
  const at = Date.now();
  for (const { key, question } of fresh)
    queueEvent(host, {
      id: `question:${key}:${at}`,
      kind: QUESTION_UNANSWERED_EVENT,
      at,
      ...(who ?? {}),
      data: { [QUESTION_DATA]: question },
    });
}

/** Pages Disagree: each new pair the conflict check found, about the page it checked (`tab`). Nobody is behind it. */
export function queueDisagreements(host: Host, tab: string, found: readonly Conflict[]): void {
  if (!hearsKnowledge(host, PAGES_DISAGREE_EVENT)) return;
  const at = Date.now();
  for (const conflict of found) {
    const other = conflict.a.tab === tab ? conflict.b.tab : conflict.a.tab;
    queueEvent(host, {
      id: `conflict:${conflict.id}`,
      kind: PAGES_DISAGREE_EVENT,
      at,
      tab,
      data: { [QUESTION_DATA]: conflict.question, [OTHER_PAGE_DATA]: other },
    });
  }
}

/** Agent Suggested a Change: one suggestion an agent made on a page. */
export function queueSuggestion(
  host: Host,
  input: { id: string; tab: string; reason: string; who: KnowledgeWho },
): void {
  queueEvent(host, {
    id: `suggestion:${input.id}`,
    kind: SUGGESTION_ADDED_EVENT,
    at: Date.now(),
    tab: input.tab,
    ...input.who,
    data: { [SUGGESTION_REASON_DATA]: input.reason },
  });
}
