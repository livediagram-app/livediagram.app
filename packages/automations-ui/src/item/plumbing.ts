// What an item's editor hands the Automations host before the screen's code loads (blueprint item-ui.md "The
// helper"; ui.md "The door"): its words by item word, its routes and its telemetry. The SAME object goes to
// `AutomationsHost` and into `defineItemAutomationsKit`. It reaches nothing of the screen and nothing of the kit
// (door-lazy-load.test.ts), so an editor's first load carries only this, the client and their types.

import type { ItemWord } from '@liveworkspace/automations/item';
import type { AutomationsClient } from '../automations-client';
import type { AutomationsEvent, AutomationsPlumbing, AutomationsWords } from '../kit';

export {
  ITEM_AUTOMATION_ERRORS,
  createItemAutomationsClient,
  type ItemAutomationsApi,
  type ItemAutomationsClient,
  type ItemListedRule,
} from './client';

// The builder's test, as every item's screen names it (kit.ts TEST_RULE, written out so this stays light).
const TEST_RULE = 'Test Rule';

/** The words the screen takes of the app, for an item called `itemWord`. `examples`: what a rule can do here, as a
 *  sentence of its own ("Snapshot it every Friday, or tell Slack when it changes."). */
export function itemAutomationsWords(itemWord: ItemWord, examples: string): AutomationsWords {
  return {
    item: itemWord,
    subject: 'tab',
    toolLine: `Rules this ${itemWord} runs on its own.`,
    subtitle: `Rules this ${itemWord} runs on its own: when something happens, it does the steps you chose.`,
    empty: `A rule watches this ${itemWord} and does the routine steps for you. ${examples.trim()} Start from one below or build your own.`,
    test: TEST_RULE,
  };
}

export interface ItemPlumbingInput {
  itemWord: ItemWord;
  /** What a rule can do for this app, as the empty state's second sentence: "Snapshot it every Friday, tell Slack
   *  when it changes, or put a workshop board back every night." */
  examples: string;
  /** The app's routes (`createItemAutomationsClient`). */
  client: AutomationsClient;
  /** The app's own telemetry calls, written out (its emitter scan reads them). `rule_run`: Run Rule. */
  track: (event: AutomationsEvent, detail?: string) => void;
}

/** The light half of an item's kit. Call it once, at module level. */
export function defineItemPlumbing(input: ItemPlumbingInput): AutomationsPlumbing {
  return {
    words: itemAutomationsWords(input.itemWord, input.examples),
    client: input.client,
    track: input.track,
  };
}
