// API tokens (docs/specs/015-api/public-api-and-tokens.md): what the api lists of a token, and what it
// says of the token a request presented. The token's own shape is @liveworkspace/api-kit/api-token's.

// An external API credential, owner-scoped to an account. The wire
// shape NEVER carries the secret or its hash — only the public id +
// metadata shown in the management list. The plaintext is returned once,
// at creation, on a separate response field (see the /api/tokens route).
export type ApiToken = {
  id: string;
  name: string | null;
  createdAt: number;
  // Null until the token is first used to authenticate a request.
  lastUsedAt: number | null;
  // Fixed at createdAt + 6 months (docs/specs/015-api/public-api-and-tokens.md).
  expiresAt: number;
  // Read-only token (docs/specs/015-api/mcp-server.md §4.11): may only make GET/HEAD requests; the api
  // rejects its writes. Minted read-only via the MCP consent screen.
  readOnly: boolean;
};

// GET /api/tokens/current (docs/specs/015-api/blueprints/cli.md "Token self-service"): the token a request
// presented, for the CLI's `auth status`. `role` is `full` or `read-only`.
export type CurrentTokenResponse = {
  accountId: string;
  accountName: string | null;
  tokenId: string;
  tokenName: string | null;
  role: 'full' | 'read-only';
  expiresAt: number | null;
};
