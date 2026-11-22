// One cheap call that proves a key works before it is saved (liveworkspace/docs/specs/003-accounts/ai-keys.md "Saving
// checks the key"): the provider's record of the chosen model, `GET /v1/models/<model>`, which spends nothing. A
// typo is never sealed, and the model is one the key can use. The provider's own words are never passed on: the
// answer is one of the failure kinds, as every model call's is. The key is in one header and nowhere else.
import { CLAUDE_API_VERSION } from './claude-request';
import { claudeFailureKind } from './claude-client';
import type { KeyProviderId, ModelFailureKind } from './model-failure';
import { modelProvider } from './model-providers';
import { openAiFailureKind } from './openai-client';

/** How long the check may take before it is given up (`other`). */
export const KEY_CHECK_TIMEOUT_MS = 8_000;

export type KeyCheck = { ok: true } | { ok: false; kind: ModelFailureKind };

/** The address of the model's record on the provider's own host. */
export const keyCheckUrl = (provider: KeyProviderId, model: string): string =>
  `https://${modelProvider(provider).host}/v1/models/${encodeURIComponent(model)}`;

/** The headers the check sends: the key as the provider expects it, and nothing else of it. */
export function keyCheckHeaders(provider: KeyProviderId, apiKey: string): Record<string, string> {
  return provider === 'openai'
    ? { authorization: `Bearer ${apiKey}` }
    : { 'x-api-key': apiKey, 'anthropic-version': CLAUDE_API_VERSION };
}

/** Asks the provider whether `apiKey` may use `model`. Never throws: a network failure, a timeout or an answer that
 *  is neither is `other`. `fetch` is the caller's (a `providerFetch`, so the host is checked where it leaves). */
export async function checkProviderKey(options: {
  provider: KeyProviderId;
  apiKey: string;
  model: string;
  fetch: typeof fetch;
  timeoutMs?: number;
}): Promise<KeyCheck> {
  const { provider } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? KEY_CHECK_TIMEOUT_MS);
  try {
    const response = await options.fetch(keyCheckUrl(provider, options.model), {
      method: 'GET',
      headers: keyCheckHeaders(provider, options.apiKey),
      signal: controller.signal,
    });
    if (response.ok) {
      await response.body?.cancel();
      return { ok: true };
    }
    // Read only to tell the kinds apart; nothing of it leaves this function.
    const body: unknown = await response.json().catch(() => undefined);
    const kind =
      provider === 'openai'
        ? openAiFailureKind(response.status, body)
        : claudeFailureKind(response.status, body);
    return { ok: false, kind };
  } catch {
    return { ok: false, kind: 'other' };
  } finally {
    clearTimeout(timer);
  }
}
