// Describe to Set Up on built-in AI (docs/specs/030-knowledgebase/describe-to-set-up.md "The model"; owner,
// 2026-11-21), asked when the knowledgebase has no key of its own: Workers AI through the `AI` binding (no key, no
// secret), the model and the bound of liveplanner's Describe a Plan. A reply that does not read is asked once more
// with fixed words for why, never the model's own text. Never throws: a binding that errs or takes past the bound is
// `failed`.
import {
  SETUP_BUILT_IN_ASKS,
  SETUP_BUILT_IN_MODEL,
  SETUP_BUILT_IN_TIMEOUT_MS,
  SETUP_REFUSED_NOT_JSON,
  SETUP_REFUSED_NO_PAGE,
  builtInReplyText,
  parseSetupSuggestion,
  setupBuiltInInput,
  type SetupExistingPage,
  type SetupSuggestion,
} from '@liveknowledge/knowledge';
import type { Env } from '../types';
import { e2eStandInOrigin } from './model-door';

export type BuiltInAi = NonNullable<Env['AI']>;

/**
 * The client built-in AI is asked through: the `AI` binding, or null where there is none (a fork without the [ai]
 * block, a test). Under the e2e stack alone (its stand-in named on the loopback, model-door.ts) the stand-in's
 * `POST /workers-ai/run` answers instead, as the binding would, so no test reaches Cloudflare.
 */
export function builtInAi(env: Pick<Env, 'AI' | 'E2E_CLAUDE_STAND_IN'>): BuiltInAi | null {
  const standIn = e2eStandInOrigin(env);
  if (standIn)
    return {
      run: async (model, input) => {
        const res = await fetch(`${standIn}/workers-ai/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input }),
        });
        if (!res.ok) throw new Error(`stand-in ${res.status}`);
        return res.json();
      },
    };
  return env.AI ?? null;
}

const SLOW = Symbol('slow');

/** One ask, bounded by the timeout: the reply's text (undefined when it holds none), or null when it failed. */
async function askOnce(client: BuiltInAi, input: object): Promise<string | undefined | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<typeof SLOW>((resolve) => {
    timer = setTimeout(() => resolve(SLOW), SETUP_BUILT_IN_TIMEOUT_MS);
  });
  try {
    const raw = await Promise.race([client.run(SETUP_BUILT_IN_MODEL, input), slow]);
    if (raw === SLOW) {
      console.warn('[knowledge] setup built-in slow');
      return null;
    }
    return builtInReplyText(raw);
  } catch (error) {
    // The binding's own words may echo the request: only that it failed, and the error's name.
    console.warn('[knowledge] setup built-in failed', {
      error: error instanceof Error ? error.name : typeof error,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type BuiltInSuggested =
  | { answer: 'suggested'; asks: number; suggestion: SetupSuggestion }
  | { answer: 'no-structure'; asks: number }
  | { answer: 'failed'; asks: number };

/** Asks for a structure until one reads or the asks are spent. */
export async function suggestOnBuiltIn(
  client: BuiltInAi,
  options: { description: string; existing: readonly SetupExistingPage[] },
): Promise<BuiltInSuggested> {
  let refused: string | undefined;
  let asks = 0;
  while (asks < SETUP_BUILT_IN_ASKS) {
    asks += 1;
    const text = await askOnce(client, setupBuiltInInput(options, refused));
    if (text === null) return { answer: 'failed', asks };
    const suggestion = text === undefined ? undefined : parseSetupSuggestion(text);
    if (suggestion) return { answer: 'suggested', asks, suggestion };
    refused = text?.includes('{') ? SETUP_REFUSED_NO_PAGE : SETUP_REFUSED_NOT_JSON;
  }
  return { answer: 'no-structure', asks };
}
