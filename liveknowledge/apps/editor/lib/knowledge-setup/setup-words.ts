// What Describe to Set Up says (docs/specs/030-knowledgebase/describe-to-set-up.md): its control, its three steps,
// and a failure in plain words with the next step. A failure of the model call reads in the words Ask uses
// (lib/knowledge-ask/ask-failure-words.ts); the limits and an answer with no structure have words of their own.
// Never a status, a code or the upstream's own message.
import type { KnowledgeAiProvider } from '@liveknowledge/api-schema';
import {
  SETUP_BUILT_IN_PER_PERSON_PER_DAY,
  SETUP_MAX_DESCRIPTION_CHARS,
  SETUP_MIN_DESCRIPTION_CHARS,
  SETUP_PER_KNOWLEDGEBASE_PER_DAY,
  SETUP_PER_PERSON_PER_HOUR,
} from '@liveknowledge/knowledge';
import { askFailureWords } from '@/lib/knowledge-ask/ask-failure-words';
import type { SetupMode } from './setup-open';

export const SETUP_BUTTON = 'Describe to Set Up';
export const SETUP_BUTTON_LINE = 'Tell AI what this is for and get a page structure.';
export const ADD_PAGES_BUTTON = 'Describe to Add Pages';

export const setupTitle = (mode: SetupMode): string =>
  mode === 'add' ? ADD_PAGES_BUTTON : SETUP_BUTTON;

export const DESCRIBE_LABEL = 'What Is This Knowledgebase For?';
export const DESCRIBE_EXAMPLE =
  'The engineering handbook for a 12 person logistics startup: how we ship, on-call, architecture and decisions.';
/** Three starting points that fill the field. */
export const DESCRIBE_CHIPS: readonly { label: string; text: string }[] = [
  { label: 'Engineering Handbook', text: DESCRIBE_EXAMPLE },
  {
    label: 'Customer Support',
    text: 'The support playbook for a small software company: how we answer tickets, refunds, escalations, our tone of voice and the known issues with their workarounds.',
  },
  {
    label: 'Company Handbook',
    text: 'The company handbook for a remote team of 30: how we work, time off, expenses, hiring, onboarding and who to ask about what.',
  },
];

/** The counter is shown from here on. */
export const DESCRIBE_COUNT_FROM = SETUP_MAX_DESCRIPTION_CHARS - 100;

/** What stops a description being sent, or null. */
export function describeHint(length: number): string | null {
  if (length === 0) return null;
  if (length < SETUP_MIN_DESCRIPTION_CHARS)
    return `A little more, please: at least ${SETUP_MIN_DESCRIPTION_CHARS} characters.`;
  if (length > SETUP_MAX_DESCRIPTION_CHARS)
    return `That is over the ${SETUP_MAX_DESCRIPTION_CHARS.toLocaleString('en')} characters a description takes.`;
  return null;
}

/** "Create 14 Pages", "Create 1 Page". */
export const createLabel = (count: number): string =>
  `Create ${count.toLocaleString('en')} ${count === 1 ? 'Page' : 'Pages'}`;

export const UNDO_NOTE = 'Pages are made twenty at a time; Undo takes back the last twenty.';

export type SetupNextStep = 'ai-settings' | 'try-again' | 'none';
export type SetupFailureWords = { title: string; text: string; step: SetupNextStep };

const MODEL_KINDS = new Set([
  'bad-key',
  'no-credit',
  'rate-limited',
  'overloaded',
  'model-unavailable',
  'refused',
  'ask_unavailable',
]);

export function setupFailureWords(
  kind: string,
  opts: { provider?: KnowledgeAiProvider | undefined },
): SetupFailureWords {
  if (MODEL_KINDS.has(kind)) {
    // Only an Editor has this dialog, so the way into AI Settings is always theirs.
    const words = askFailureWords(kind, { manageAi: true, provider: opts.provider });
    return {
      title:
        kind === 'ask_unavailable' ? 'Describe to Set Up Is Not Available Right Now' : words.title,
      text: words.text
        .replace(/\bask again\b/g, 'try again')
        .replace(/\bAsking again\b/g, 'Trying again'),
      step:
        words.step === 'ai-settings'
          ? 'ai-settings'
          : words.step === 'ask-again'
            ? 'try-again'
            : 'none',
    };
  }
  switch (kind) {
    case 'built-in-unavailable':
      return {
        title: 'Built-In AI Is Not Set Up Here',
        text: "This server has no built-in AI. Add your team's AI key, from Anthropic or OpenAI, in AI Settings to describe what this knowledgebase is for.",
        step: 'ai-settings',
      };
    case 'built-in-limit':
      return {
        title: `You Have Used Today's ${SETUP_BUILT_IN_PER_PERSON_PER_DAY} Built-In Suggestions`,
        text: "That is the most built-in AI gives one person in a day, across every knowledgebase. Try again tomorrow, or add your team's AI key in AI Settings.",
        step: 'ai-settings',
      };
    case 'built-in-failed':
      return {
        title: 'The Built-In AI Could Not Answer',
        text: 'It did not answer just now. Try again in a moment.',
        step: 'try-again',
      };
    case 'person-limit':
      return {
        title: `You Have Asked for ${SETUP_PER_PERSON_PER_HOUR} Structures This Hour`,
        text: 'That is the most one person may ask for in an hour. Try again later, or add pages by hand in the meantime.',
        step: 'none',
      };
    case 'knowledgebase-limit':
      return {
        title: `This Knowledgebase Has Had Its ${SETUP_PER_KNOWLEDGEBASE_PER_DAY} Structures Today`,
        text: 'That is the most a knowledgebase is given in a day. Try again tomorrow, or add pages by hand in the meantime.',
        step: 'none',
      };
    case 'no-description':
    case 'description-too-long':
      return {
        title: 'That Description Cannot Be Used',
        text: `A description is ${SETUP_MIN_DESCRIPTION_CHARS} to ${SETUP_MAX_DESCRIPTION_CHARS.toLocaleString('en')} characters. Change it and try again.`,
        step: 'none',
      };
    case 'forbidden':
    case 'sign_in_required':
      return {
        title: 'Only a Signed-In Editor Can Do This',
        text: 'Describe to Set Up spends an AI call, so it is for someone who edits this knowledgebase and is signed in.',
        step: 'none',
      };
    case 'network':
      return {
        title: 'The Description Could Not Be Sent',
        text: 'Check your connection, then try again.',
        step: 'try-again',
      };
    default:
      // `no-structure`, and anything this editor has no words for.
      return {
        title: 'Could Not Suggest a Structure',
        text: 'The answer that came back held no pages that could be used. Try again, or say a little more about what the knowledgebase is for.',
        step: 'try-again',
      };
  }
}
