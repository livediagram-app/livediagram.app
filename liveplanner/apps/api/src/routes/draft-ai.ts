// Which AI an AI draft runs on (Describe a Plan, a Form, a Rule; liveworkspace/docs/specs/003-accounts/ai-keys.md
// "Every AI feature honours the choice"; docs/specs/026-plan/describe-a-plan.md "Which AI drafts it"): the person's own
// key, or the plan's team's, when one applies, else the AI actions' built-in model. Asked once per draft, after the
// request's own checks and before any allowance is spent. The key reaches only the runner it builds.
import {
  AI_KEY_FAILED,
  aiKeyFailureWords,
  keyedRunner,
  ownKeyOf,
  type AiKeyFailure,
  type AiKeySource,
} from '@liveworkspace/ai';
import { personAiKey, type AiKeyCaller } from '@liveworkspace/auth-client/ai-key';
import { AUTOMATION_KEYED_TIMEOUT_MS, type AskKeyFailure } from '@liveworkspace/automations/room';
import { accountCredentials } from '../auth/accounts';
import { json } from '../responses';
import type { AutomationsAi, Env } from '../types';
import { aiClient } from '../plan-room/automations/automation-ai';

export type DraftAi =
  // On a key: the runner, whose key it is, and the longer wait a thinking model needs. Nothing built-in is spent.
  | { keyed: true; client: AutomationsAi; source: AiKeySource; timeoutMs: number }
  // Built-in AI: the binding (null where there is none), spending the feature's allowance as before.
  | { keyed: false; client: AutomationsAi | null }
  // Refused in words: accounts could not say, or the key will not open. Never sent to built-in AI instead.
  | { refused: Response };

/** A key's failure as the drafts answer it: 422 `ai_key_failed`, the fixed words and whose key, never the key. */
export const keyFailedResponse = (aiKey: AiKeyFailure, message = aiKeyFailureWords(aiKey)) =>
  json({ error: AI_KEY_FAILED, message, aiKey }, { status: 422 });

/** The AI the caller's draft runs on, in `teamId`'s work (none before a plan exists). `unavailable`: the refusal for
 *  accounts that could not answer, in the feature's own code. */
export async function draftAi(
  ctx: { env: Env } & AiKeyCaller,
  teamId: string | null,
  unavailable: (message: string) => Response,
): Promise<DraftAi> {
  const own = ownKeyOf(await personAiKey(accountCredentials(ctx.env), ctx, teamId));
  if (own.status === 'refused')
    return {
      refused:
        own.reason === 'unreadable'
          ? keyFailedResponse(own.failure, own.words)
          : unavailable(own.words),
    };
  if (own.status === 'key')
    return {
      keyed: true,
      client: keyedRunner(own.caller),
      source: own.source,
      timeoutMs: AUTOMATION_KEYED_TIMEOUT_MS,
    };
  return { keyed: false, client: aiClient(ctx.env) };
}

/** A failed ask on a key: the failure a person fixes, said with whose key, or null for a passing one. */
export const keyFailureOf = (
  ai: DraftAi,
  failure: AskKeyFailure | undefined,
): AiKeyFailure | null =>
  'keyed' in ai && ai.keyed && failure ? { source: ai.source, ...failure } : null;
