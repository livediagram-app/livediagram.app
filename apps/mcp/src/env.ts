// Worker bindings (wrangler.toml), in their own module so tools / api / render
// can import the type without cycling through the Hono entrypoint.
export type Env = {
  // Service binding to livediagram-api — tools forward to /api/* through it,
  // carrying the caller's Bearer lvd_ token.
  API: Fetcher;
  // OAuth 2.1 state: client registrations, authorize sessions, codes.
  OAUTH_KV: KVNamespace;
};
