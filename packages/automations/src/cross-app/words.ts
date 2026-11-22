// Steps in other apps in words (liveworkspace/docs/specs/018-automations/automations.md "Steps in other apps",
// "Loops across apps", "Limits"): a target as the sentence names it, and each answer as its step's line on the Audit
// Trail says it. Pure.

import {
  CROSS_APP_AUTHOR_DAY_MAX,
  CROSS_APP_HOPS_MAX,
  CROSS_APP_RULE_DAY_MAX,
  type App,
  type CrossAppRefusal,
  type CrossAppTarget,
} from '@liveworkspace/index-client';

const APP_WORDS: Readonly<Record<App, string>> = {
  livediagram: 'livediagram',
  liveplanner: 'liveplanner',
  livedocuments: 'livedocuments',
  livedesign: 'livedesign',
  livehuddle: 'livehuddle',
  liveknowledge: 'liveknowledge',
};

/** An app's name as the builder's eyebrow says it ("Then · liveknowledge"). */
export const appWord = (app: App): string => APP_WORDS[app];

/** A target by the title it was picked with, quoted; `none` while nothing is picked. */
export const targetWords = (target: CrossAppTarget, none: string): string =>
  target.item ? `“${target.title || 'Untitled'}”` : none;

export const CROSS_APP_LOOP = 'Skipped: would loop back to this rule';
export const CROSS_APP_CHAIN_LONG = `Stopped after ${CROSS_APP_HOPS_MAX} hops across apps`;
export const CROSS_APP_CHAIN_RULE = `One chain may not fire the same rule twice, and stops after ${CROSS_APP_HOPS_MAX} hops across apps.`;
export const CROSS_APP_RULE_CAPPED = `This rule ran ${CROSS_APP_RULE_DAY_MAX} times with steps in other apps today; they run again tomorrow`;
export const CROSS_APP_AUTHOR_CAPPED = `Your rules have run their ${CROSS_APP_AUTHOR_DAY_MAX} steps in other apps today; they run again tomorrow`;
export const CROSS_APP_NOT_SET_UP = "Steps in other apps aren't set up here";
export const CROSS_APP_NO_AUTHOR =
  'Nobody is the author of this rule: an Editor must save it first';
export const CROSS_APP_EMPTY = 'The step came out empty';
export const CROSS_APP_UNREACHED = "Couldn't reach the other app; the run may be tried again";

/** "Stopped: no access to “Docs”": the rule pauses with it. */
export const noAccessWords = (target: CrossAppTarget | null): string =>
  `Stopped: no access to ${target ? targetWords(target, 'the target') : 'the people'}`;

/** Whether a rule's pause is a step in another app's lost access (or no author): anyone who can edit the item may
 *  Take Over the rule, which saves it as theirs and turns it back on. */
export const isAccessPause = (reason: string): boolean =>
  reason.startsWith('Stopped: no access') || reason === CROSS_APP_NO_AUTHOR;

/** An access pause's reason after "Paused: ", its own "Stopped: " dropped: "no access to “Notes”". */
export const accessPauseWords = (reason: string): string => reason.replace(/^Stopped: /, '');

/** A refusal's words for the step's line: the index's or the target's reason where it gave one. */
export function refusalWords(
  code: CrossAppRefusal,
  reason: string,
  target: CrossAppTarget | null,
): string {
  switch (code) {
    case 'no_access':
      return noAccessWords(target);
    case 'loop':
      return CROSS_APP_LOOP;
    case 'chain_long':
      return CROSS_APP_CHAIN_LONG;
    case 'capped':
      return CROSS_APP_AUTHOR_CAPPED;
    case 'unavailable':
      return CROSS_APP_UNREACHED;
    default:
      return reason || "Couldn't do it in the other app";
  }
}
