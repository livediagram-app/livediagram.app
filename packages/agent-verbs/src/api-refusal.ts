// The api's refusals as agents read them ("Errors that teach"): what was wrong and the next call to make, the same
// words on the CLI and the MCP. A 5xx or anything not from the api is not a refusal: the caller lets it throw.
// The words name the product's files and its MCP tools (`find_<collection>`, `restore_<noun>`).
import { ApiError } from '@liveworkspace/api-client';
import type { AgentProduct } from './product';

export interface ApiRefusal {
  code: string;
  message: string;
}

export function createApiRefusal(product: Pick<AgentProduct, 'noun' | 'collection'>) {
  const { noun, collection } = product;
  const BY_STATUS: Readonly<Record<number, string>> = {
    401: 'the token is not accepted: sign in again.',
    403: `you may view this ${noun} but not change it (or not this part of it).`,
    404: `no such ${noun}, or it is not shared with you. find_${collection} lists them.`,
    410: `that ${noun} is in the Trash: restore it with restore_${noun} first.`,
    413: `that is more than the ${noun} can hold.`,
    // A burst past the per-token limit (docs/specs/015-api/public-api-and-tokens.md §3.5): the window is a minute.
    429: 'too many calls in the last minute (the limit is per token). Wait about a minute, then make the same call again.',
  };

  return function apiRefusalOf(err: unknown): ApiRefusal | null {
    if (!(err instanceof ApiError) || err.status >= 500) return null;
    const code = err.code ?? `http_${err.status}`;
    const known = BY_STATUS[err.status];
    if (known) return { code, message: `The api refused it: ${known}` };
    return { code, message: `The api refused it (${code}).` };
  };
}
