// A question that could not be answered, in plain words with the next step (docs/specs/030-knowledgebase/
// search-and-ask.md "Bounds"): never a status, a code or the upstream's own message. The kind is the stream's
// `error` event's (the model call's failure), the route's refusal before the stream, or the client's own (`network`).
import {
  ASK_MAX_QUESTION_CHARS,
  ASK_PER_KNOWLEDGEBASE_PER_DAY,
  ASK_PER_PERSON_PER_HOUR,
} from '@liveknowledge/knowledge';

/** What the person can do next: open AI Settings, ask the same question again, or nothing but wait or reword. */
export type AskNextStep = 'ai-settings' | 'ask-again' | 'none';
export type AskFailureWords = { title: string; text: string; step: AskNextStep };

const count = (n: number) => n.toLocaleString('en');

export function askFailureWords(kind: string, opts: { manageAi: boolean }): AskFailureWords {
  // Someone who cannot open the controls is told who can.
  const settings = (editor: string, other: string): Pick<AskFailureWords, 'text' | 'step'> =>
    opts.manageAi ? { text: editor, step: 'ai-settings' } : { text: other, step: 'none' };
  switch (kind) {
    case 'bad-key':
      return {
        title: 'Claude Did Not Accept the Key',
        ...settings(
          'The key may have been revoked or mistyped. Replace it in AI Settings.',
          'The key may have been revoked. Ask an Editor to replace it in AI Settings.',
        ),
      };
    case 'no-credit':
      return {
        title: 'The Claude Account Is Out of Credit',
        text: "The account behind this knowledgebase's key has no credit left. Once credit is added in the Claude Console, ask again.",
        step: 'ask-again',
      };
    case 'rate-limited':
      return {
        title: 'The Claude Account Is at Its Rate Limit',
        text: "The account behind this knowledgebase's key is sending as much as it may. Wait a minute, then ask again.",
        step: 'ask-again',
      };
    case 'overloaded':
      return {
        title: 'Claude Is Busy Right Now',
        text: 'Nothing is wrong with the key or the question. Ask again in a moment.',
        step: 'ask-again',
      };
    case 'model-unavailable':
      return {
        title: 'This Key Cannot Use the Chosen Model',
        ...settings(
          'Choose another model in AI Settings.',
          'Ask an Editor to choose another model in AI Settings.',
        ),
      };
    case 'refused':
      return {
        title: 'Claude Declined to Answer This',
        text: 'Asking again will not change that. Try the question in other words, or search the pages.',
        step: 'none',
      };
    case 'person-limit':
      return {
        title: `You Have Asked ${count(ASK_PER_PERSON_PER_HOUR)} Questions This Hour`,
        text: 'That is the most one person may ask in an hour. Ask again later; search works in the meantime.',
        step: 'none',
      };
    case 'knowledgebase-limit':
      return {
        title: `This Knowledgebase Has Had Its ${count(ASK_PER_KNOWLEDGEBASE_PER_DAY)} Questions Today`,
        text: 'That is the most a knowledgebase answers in a day. Ask again tomorrow; search works in the meantime.',
        step: 'none',
      };
    case 'question-too-long':
      return {
        title: 'That Question Is Too Long',
        text: `A question is at most ${count(ASK_MAX_QUESTION_CHARS)} characters. Shorten it and ask again.`,
        step: 'none',
      };
    case 'no-question':
      return {
        title: 'There Was No Question',
        text: 'Type a question, then send it.',
        step: 'none',
      };
    case 'ask_unavailable':
      return {
        title: 'Ask Is Not Available Right Now',
        ...settings(
          'The key is missing or could not be read. Add it again in AI Settings.',
          'The key is missing or could not be read. Ask an Editor to add it again.',
        ),
      };
    case 'sign_in_required':
      return {
        title: 'Sign In to Ask',
        text: "Ask spends the team's own Claude key, so it answers people who are signed in.",
        step: 'none',
      };
    case 'network':
      return {
        title: 'The Question Could Not Be Sent',
        text: 'Check your connection, then ask again.',
        step: 'ask-again',
      };
    default:
      return {
        title: 'The Answer Could Not Be Made',
        text: 'Something went wrong on the way. Ask again.',
        step: 'ask-again',
      };
  }
}
