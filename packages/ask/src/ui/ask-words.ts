// Ask AI's words that depend on the app or on which AI answers (liveworkspace/docs/specs/019-ask/ask.md). Pure.
import { APP_ITEMS, siteOfApp, type AppName } from '@liveworkspace/sites';
import type { AiSourceLine } from '@liveworkspace/settings-ui/ai-source';
import type { AskProvider } from '../wire';
import type { AskAiChoice } from './ask-ai-choice';

export const BUILT_IN_LABEL = 'Built-In AI';

/** The app's item in a sentence ("canvas", "plan") and as a title ("Canvas"). */
export const itemWords = (app: AppName): { noun: string; lower: string } => {
  const { noun } = APP_ITEMS[app];
  return { noun, lower: noun.toLowerCase() };
};

export const builtInDetail = (app: AppName): string =>
  `Included with ${siteOfApp(app).name}, with daily limits`;

export const nothingToReadWords = (app: AppName): string =>
  `This ${itemWords(app).lower} has no text to answer from yet. Add some and ask again.`;

const OWNER = { you: 'Your Key', team: 'Your Team’s Key', item: 'Its Own Key' } as const;
const PROVIDER = { anthropic: 'Anthropic', openai: 'OpenAI' } as const;

/** What the AI pill and the Answer With menu say, from the source line and the person's choice. */
export type AskAiView = {
  /** Which AI the next question runs on. */
  using: 'loading' | 'built-in' | 'key' | 'failed';
  /** The pill's words. */
  label: string;
  /** The key that applies, where one does: its row in the menu. */
  key: { label: string; detail: string } | null;
};

export function askAiView(line: AiSourceLine | null, choice: AskAiChoice): AskAiView {
  if (line?.kind === 'loading') return { using: 'loading', label: '', key: null };
  if (line?.kind === 'key') {
    const key = {
      label: OWNER[line.owner],
      detail: `${PROVIDER[line.provider]} · ${line.model} · No daily limits`,
    };
    return choice === 'built-in'
      ? { using: 'built-in', label: BUILT_IN_LABEL, key }
      : { using: 'key', label: `${line.model} (${OWNER[line.owner]})`, key };
  }
  if (line?.kind === 'failed') {
    const key = { label: `${OWNER[line.owner]} Needs Attention`, detail: line.words };
    return choice === 'built-in'
      ? { using: 'built-in', label: BUILT_IN_LABEL, key }
      : { using: 'failed', label: 'Key Needs Attention', key };
  }
  // Built-in AI, or a line that could not be read: the server decides, and built-in AI is what it falls to.
  return { using: 'built-in', label: BUILT_IN_LABEL, key: null };
}

/** Which AI answered a turn, for its foot: "Built-In AI", or the model's own name as the line knows it. */
export function answeredBy(
  provider: AskProvider | undefined,
  model: string | undefined,
  line: AiSourceLine | null,
): string | null {
  if (!provider) return null;
  if (provider === 'built-in') return BUILT_IN_LABEL;
  return line?.kind === 'key' ? line.model : (model ?? PROVIDER[provider]);
}
