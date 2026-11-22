// The one way out to a provider (liveworkspace/docs/specs/003-accounts/ai-keys.md "Saving checks the key"): its own API
// host, over HTTPS on the default port, and nowhere else, whatever a request is built to say. A customer's key rides
// on these requests, so the address is checked where the request leaves, never taken from a caller: no URL anyone
// sends can turn a key check or a model call towards another host.
import { modelProvider } from './model-providers';
import type { KeyProviderId } from './model-failure';

const addressOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** Whether `url` is the provider's own API, over HTTPS on its default port. */
export function isProviderUrl(url: string, provider: KeyProviderId): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && parsed.host === modelProvider(provider).host;
}

/** `fetch`, refusing any address that is not the provider's API. The refusal names no address. */
export const providerFetch =
  (provider: KeyProviderId, through: typeof fetch = fetch): typeof fetch =>
  (input, init) =>
    isProviderUrl(addressOf(input), provider)
      ? through(input, init)
      : Promise.reject(new Error('outbound host refused'));
