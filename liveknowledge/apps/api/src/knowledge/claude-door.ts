// The one way out to a model (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the Anthropic API's host, over
// HTTPS, and nowhere else, whatever a request is built to say. The team's key and their pages' passages ride on
// these requests, so the address is checked where the request leaves. Tests stub the global `fetch`.
export const CLAUDE_HOST = 'api.anthropic.com';

const addressOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** `fetch`, refusing any address that is not the Anthropic API's. */
export const claudeDoor: typeof fetch = (input, init) => {
  const url = new URL(addressOf(input));
  if (url.protocol !== 'https:' || url.host !== CLAUDE_HOST)
    return Promise.reject(new Error('outbound host refused'));
  return fetch(input, init);
};
