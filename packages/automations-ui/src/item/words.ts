// The item screen's words (blueprint item-ui.md "What is shared and what an app adds"): each shared kind's tile
// line, what a rule needs and has left to pick, and how a run from the list is said. Pure. The tool's own line,
// subtitle and empty state are the plumbing's (plumbing.ts), which loads with the editor.

import { AUTOMATION_RUNS_PER_DAY, type AutomationResult } from '@liveworkspace/automations';
import {
  UNPICKED_NAMES,
  inTabWords,
  itemWordTitle,
  type ItemRef,
  type ItemRefKind,
  type ItemWord,
} from '@liveworkspace/automations/item';

// Lines of fixed words, in the item's word for a tab (tab-word.ts).
const worded = (item: ItemWord, lines: Record<string, string>): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(lines).map(([k, line]) => [k, inTabWords(line, item)]));

const sentence = (line: string): string => {
  const text = line.trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}`;
};

/** A kind's registry line as its tile says it: a capital and a full stop. */
export const tileLine = sentence;

/** Each shared trigger's tile line, in the app's word for the item. */
export const sharedTriggerLines = (item: ItemWord): Readonly<Record<string, string>> =>
  worded(item, {
    scheduled: 'A time comes round: every day, every weekday, weekly or monthly.',
    manual: 'An Editor presses Run Rule on this rule.',
    incoming_webhook:
      'Another tool, such as CI or a form, sends this rule’s address JSON, proved with its secret.',
    tab_added: `A tab is added to this ${item}.`,
    tab_removed: `A tab is removed from this ${item}.`,
    edited: `This ${item} changes, then nothing changes for a while. Once per burst of edits.`,
    not_edited: `Nothing in this ${item} has changed for a number of days.`,
    snapshot_taken: 'Someone takes a snapshot by hand.',
    joined: `A person opens this ${item} through a share link for the first time.`,
    access_requested: `Someone asks for access to this ${item}.`,
    comment_added: 'Someone starts a thread or replies on one.',
    thread_resolved: 'A thread is resolved.',
    threads_resolved: 'The last open thread on a tab is resolved.',
    action_assigned: 'An action gets a new assignee.',
    action_done: 'An action is turned done.',
  });

/** Each shared step's tile line, by its key (`stepKey`). */
export const sharedActionLines = (item: ItemWord): Readonly<Record<string, string>> =>
  worded(item, {
    take_snapshot: `Take a snapshot of the whole ${item}, named by the rule.`,
    revert_snapshot: `Put the whole ${item} back to a chosen snapshot, for everyone.`,
    email: 'Email the owner, whoever started the rule, a chosen person or typed-in addresses.',
    add_tab: 'Add a tab made from a template, named by the rule.',
    notify_webhook: 'Send a signed event to your own service.',
    notify_slack: 'Post a message with a link to a Slack channel.',
    notify_teams: 'Post a message with a link to a Microsoft Teams channel.',
    ai_summarise: `Read this ${item}, or one tab, and keep a summary for the steps after.`,
    wait: 'Hold the rest of the rule for an hour up to 30 days.',
  });

/** When a trigger with nothing to set starts, as its panel says it. */
export const startsWhen = (line: string): string =>
  `Starts when ${line.trim().replace(/[.!?]$/, '')}.`;

const GONE_NOUN: Readonly<Record<ItemRefKind, string>> = {
  tab: 'A tab',
  snapshot: 'A snapshot',
  connection: 'A connection',
  template: 'A template',
  person: 'Someone',
};

/** One need as people read it, never by id: "A tab is gone", "Pick a snapshot". `item`: the item's word, for
 *  its word for a tab. */
export const needWord = (need: ItemRef, item: ItemWord = 'document'): string =>
  need.id === '' ? pickWords(need.kind, item) : inTabWords(`${GONE_NOUN[need.kind]} is gone`, item);

/** What a rule needs, each kind of need once: "A tab is gone · Pick a snapshot". */
export const needWords = (attention: readonly ItemRef[], item: ItemWord = 'document'): string =>
  [...new Set(attention.map((need) => needWord(need, item)))].join(' · ');

/** What a template, a copy or a draft left to pick: "Pick a snapshot". A pick the registry lacks reads as it is. */
export const pickWords = (pick: string, item: ItemWord = 'document'): string => {
  // A step in another app's target: the plan, knowledgebase, Space or document it acts on.
  if (pick === 'target') return 'Pick where it goes';
  const unpicked = UNPICKED_NAMES[pick as ItemRefKind];
  return `Pick ${unpicked ? inTabWords(unpicked, item) : pick}`;
};

/** What a refused field's name asks for, where a save says a part "must name one", in the item's words. */
export const itemRefusalPicks = (item: ItemWord): Readonly<Record<string, string>> => ({
  tab: inTabWords(UNPICKED_NAMES.tab, item),
  tabs: inTabWords(UNPICKED_NAMES.tab, item),
  snapshot: UNPICKED_NAMES.snapshot,
  template: UNPICKED_NAMES.template,
});

/** The same, in a document's words. */
export const ITEM_REFUSAL_PICKS: Readonly<Record<string, string>> = itemRefusalPicks('document');

/** A thing the rule names that the item no longer has, in a select: "Launch Notes (No Longer Here)". */
export const goneLabel = (
  kind: ItemRefKind,
  name?: string | null,
  item: ItemWord = 'document',
): string => `${name || inTabWords(GONE_NOUN[kind], item)} (No Longer Here)`;

/** The item's word with a capital, for a heading or a chip. */
export const itemTitle = itemWordTitle;

export type RunToast = { tone: 'success' | 'error' | 'info'; text: string };

/** What a run from the list says, as a toast. `goesOn`: when a waiting run goes on, in words. */
export function runToast(
  name: string,
  run: { result: AutomationResult; reason?: string | undefined },
  goesOn?: string,
): RunToast {
  if (run.result === 'failed')
    return { tone: 'error', text: run.reason || `“${name}” didn’t run.` };
  if (run.result === 'done') return { tone: 'success', text: `Ran “${name}”` };
  if (run.result === 'waiting')
    return {
      tone: 'success',
      text: goesOn
        ? `Ran “${name}” up to its Wait. It goes on ${goesOn}.`
        : `Ran “${name}” up to its Wait.`,
    };
  return { tone: 'info', text: run.reason || `“${name}” found nothing to do.` };
}

/** A refused run in words: the day's budget, a rule that is not by hand, a tab that went. */
export function runRefusalWords(code: string, message: string, item: string): string {
  if (code === 'automation_budget_spent')
    return `This ${item} has used today’s ${AUTOMATION_RUNS_PER_DAY.toLocaleString('en')} runs. It runs again tomorrow.`;
  if (code === 'automation_not_manual') return 'Only a Run by Hand rule runs from here.';
  if (code === 'automation_not_found') return 'This rule was deleted elsewhere.';
  if (code === 'tab_not_found')
    return inTabWords('That tab is no longer here. Pick another.', item as ItemWord);
  return message;
}
