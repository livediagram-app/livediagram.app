// The one MCP's bindings (its wrangler.toml): a service binding to each app's MCP Worker, its own OAuth state, and
// the consent page's origin (liveworkspace.app).
import type { Binding } from './apps';

export type Env = Record<Binding, Fetcher> & {
  OAUTH_KV: KVNamespace;
  CONSENT_BASE_URL?: string;
};
