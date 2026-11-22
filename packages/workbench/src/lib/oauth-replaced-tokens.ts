// The account's API tokens as the OAuth pages reach them (docs/specs/015-api/mcp-server.md "Consent + mint"): over
// liveworkspace's account API through the app's router (`/api/workspace/account`, the bearer door Settings uses),
// with the person's access token, for the list at the token cap and for a reconnect's revoke of the token it
// replaces. Tokens are liveworkspace's; the app keeps none.
import {
  bearerSettingsRequest,
  type ApiToken,
  type SettingsRequest,
} from '@liveworkspace/settings-ui/token-list';
import { workbench } from '../bindings';

/** The account API's token routes, with the person's access token read as each request goes. */
export function accountTokensRequest(): SettingsRequest {
  return bearerSettingsRequest({
    baseUrl: '/api/workspace/account',
    token: () => workbench.api.currentBearer(),
  });
}

// At most as many as the MCP keeps for one client.
const REPLACES_MAX = 5;

/** The ids an MCP's /oauth/complete answered as replaced, as far as they are ids at all. */
export function replacedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .slice(0, REPLACES_MAX);
}

/**
 * Revokes the tokens a reconnect replaces, once the new one (`newId`) has been handed over: only ids the MCP named
 * that are still among the account's live tokens and carry the new token's name, so a manual token or another
 * client's is never touched, and nothing at all when the new token is not live. Throws when the list can't be read.
 */
export async function revokeReplacedTokens(
  request: SettingsRequest,
  newId: string,
  replaces: readonly string[],
): Promise<void> {
  if (replaces.length === 0) return;
  const listed = await request<{ tokens: ApiToken[] }>('/tokens');
  if (!listed.ok) throw new Error(listed.error);
  const { tokens } = listed.data;
  const fresh = tokens.find((t) => t.id === newId);
  if (!fresh) return;
  const earlier = tokens.filter(
    (t) => t.id !== newId && t.name === fresh.name && replaces.includes(t.id),
  );
  // Sent so they outlive the page, which moves on to the client's redirect straight after.
  await Promise.all(
    earlier.map((t) => request(`/tokens/${t.id}`, 'DELETE', undefined, { keepalive: true })),
  );
}

/** Least recently used first (a token never used by when it was made), the order to choose one to revoke in. */
export function leastRecentlyUsedFirst(tokens: readonly ApiToken[]): ApiToken[] {
  return [...tokens].sort((a, b) => (a.lastUsedAt ?? a.createdAt) - (b.lastUsedAt ?? b.createdAt));
}
