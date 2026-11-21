// What Describe Structure says (docs/specs/030-knowledgebase/describe-to-set-up.md "Describe Structure on a page"):
// its button, its dialog and a failure in plain words with the next step. A failure of the model call on the team's
// key reads in the words Ask uses; never a status, a code or the upstream's own message.
import type { AskAiChoice, KnowledgeAiProvider, KnowledgeAiSettings } from '@liveknowledge/api-schema';
import {
  STRUCTURE_BUILT_IN_PER_PERSON_PER_DAY,
  STRUCTURE_MAX_PURPOSE_CHARS,
  STRUCTURE_PER_KNOWLEDGEBASE_PER_DAY,
  STRUCTURE_PER_PERSON_PER_HOUR,
} from '@liveknowledge/knowledge';
import { aiInUseLine } from '@/lib/knowledge-ask/ai-settings-words';
import { offersAiChoice } from '@/lib/knowledge-ask/ask-ai-choice';
import { askFailureWords } from '@/lib/knowledge-ask/ask-failure-words';

export const STRUCTURE_BUTTON = 'Describe Structure';
export const STRUCTURE_SUBTITLE =
  'Say what this page is for and AI drafts its headings. Nothing is saved until you press Save.';
export const STRUCTURE_LABEL = 'What Is This Page For?';

/** The field's placeholder, from the page's title when it has one. */
export const structurePlaceholder = (title: string): string =>
  title.trim() ? `What goes on “${title.trim()}”, in your own words.` : 'In your own words.';

/** What stops the words being sent, or null. */
export const purposeHint = (length: number): string | null =>
  length > STRUCTURE_MAX_PURPOSE_CHARS
    ? `That is over the ${STRUCTURE_MAX_PURPOSE_CHARS} characters this takes.`
    : null;

/** Whether the person's choice of built-in AI applies: a key is set, built-in AI is here, and they chose it. */
export const usesChosenBuiltIn = (
  settings: Pick<KnowledgeAiSettings, 'hasKey' | 'builtIn'> | null,
  choice: AskAiChoice,
): boolean => settings !== null && offersAiChoice(settings) && choice === 'built-in';

/** The quiet line under the field saying which AI answers, as Ask says it: nothing until the settings are read. */
export function structureAiLine(
  settings: Pick<KnowledgeAiSettings, 'hasKey' | 'builtIn'> | null,
  choice: AskAiChoice,
): string | null {
  return usesChosenBuiltIn(settings, choice) ? 'Uses built-in AI' : aiInUseLine(settings);
}

export type StructureFailureWords = { title: string; text: string; settings: boolean };

const MODEL_KINDS = new Set([
  'bad-key',
  'no-credit',
  'rate-limited',
  'overloaded',
  'model-unavailable',
  'refused',
  'ask_unavailable',
]);

/** A failure in words. `manageAi`: whether the person may open AI Settings (an Editor). */
export function structureFailureWords(
  kind: string,
  opts: { provider?: KnowledgeAiProvider | undefined; manageAi: boolean },
): StructureFailureWords {
  if (MODEL_KINDS.has(kind)) {
    const words = askFailureWords(kind, { manageAi: opts.manageAi, provider: opts.provider });
    return {
      title: kind === 'ask_unavailable' ? 'Describe Structure Is Not Available Right Now' : words.title,
      text: words.text.replace(/\bask again\b/g, 'try again').replace(/\bAsk again\b/g, 'Try again'),
      settings: words.step === 'ai-settings',
    };
  }
  const key = opts.manageAi
    ? "add your team's AI key in AI Settings"
    : "ask an Editor to add your team's AI key";
  switch (kind) {
    case 'built-in-unavailable':
      return {
        title: 'Built-In AI Is Not Set Up Here',
        text: `This server has no built-in AI. To draft pages with AI, ${key}.`,
        settings: opts.manageAi,
      };
    case 'built-in-limit':
      return {
        title: `You Have Used Today's ${STRUCTURE_BUILT_IN_PER_PERSON_PER_DAY} Built-In Drafts`,
        text: `That is the most built-in AI drafts for one person in a day. Try again tomorrow, or ${key}.`,
        settings: opts.manageAi,
      };
    case 'person-limit':
      return {
        title: `You Have Asked for ${STRUCTURE_PER_PERSON_PER_HOUR} Structures This Hour`,
        text: 'That is the most one person may ask for in an hour. Try again later, or write the headings by hand.',
        settings: false,
      };
    case 'knowledgebase-limit':
      return {
        title: `This Knowledgebase Has Had Its ${STRUCTURE_PER_KNOWLEDGEBASE_PER_DAY} Structures Today`,
        text: 'That is the most a knowledgebase is given in a day. Try again tomorrow, or write the headings by hand.',
        settings: false,
      };
    case 'no-purpose':
    case 'purpose-too-long':
      return {
        title: 'Say What the Page Is For',
        text: `Give the page a title, or say what it is for in up to ${STRUCTURE_MAX_PURPOSE_CHARS} characters.`,
        settings: false,
      };
    case 'forbidden':
    case 'sign_in_required':
    case 'needs_a_person':
      return {
        title: 'Only a Signed-In Editor Can Do This',
        text: 'Describe Structure spends an AI call, so it is for someone who edits this page and is signed in.',
        settings: false,
      };
    case 'network':
      return {
        title: 'The Request Could Not Be Sent',
        text: 'Check your connection, then try again.',
        settings: false,
      };
    default:
      // `no-structure`, `built-in-failed`, and anything this editor has no words for.
      return {
        title: 'The AI Could Not Draft This Page',
        text: 'Nothing came back that could be used. Try again, or say a little more about what the page is for.',
        settings: false,
      };
  }
}
