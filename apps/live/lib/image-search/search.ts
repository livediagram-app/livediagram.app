// One page of an Openverse image search, straight from the browser
// (docs/specs/009-elements/image-search.md "Where the requests go"). `fetch`
// is injected so tests drive every answer without a network.

import {
  OpenverseSearchError,
  openverseSearchUrl,
  parseOpenverseSearch,
  type OpenverseSearchPage,
} from './openverse';

export async function searchOpenverse(
  query: string,
  page: number,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenverseSearchPage> {
  let res: Response;
  try {
    res = await fetchImpl(openverseSearchUrl(query, page), {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new OpenverseSearchError('failed');
  }
  if (res.status === 429) throw new OpenverseSearchError('rate-limited', 429);
  if (!res.ok) throw new OpenverseSearchError('failed', res.status);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new OpenverseSearchError('failed', res.status);
  }
  return parseOpenverseSearch(json, page);
}
