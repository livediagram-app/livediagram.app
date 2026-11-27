// The one MCP's two envs (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in").
//
// `WorkerEnv` is what its wrangler.toml binds: each app's api, each app's editor origin and telemetry key, its own
// OAuth state and the consent page's origin. `Env` is what the router reads: the same OAuth state and consent
// origin, with each app's MCP package as a `Fetcher` under the app's binding name (app-workers.ts builds them), and
// one app api to check account tokens on.
import type { AppId, Binding } from './apps';

export type Env = Record<Binding, Fetcher> & {
  OAUTH_KV: KVNamespace;
  CONSENT_BASE_URL?: string;
  // An app api, where an account token is checked with liveworkspace before a request runs (bearer.ts). Unset (a
  // test's stubs) checks nothing.
  TOKEN_API?: Fetcher;
};

type PerApp<Suffix extends string, T> = { [B in Binding as `${B}${Suffix}`]: T };

export type WorkerEnv = PerApp<'_API', Fetcher> &
  Partial<PerApp<'_BASE_URL', string>> &
  Partial<PerApp<'_TELEMETRY_KEY', string>> & {
    OAUTH_KV: KVNamespace;
    CONSENT_BASE_URL?: string;
    // The liveworkspace telemetry service. Unset is production's; staging and local development name their own.
    TELEMETRY_URL?: string;
    // `true` only in local development (the dev script): `/<app>/mcp` serves that app's package as it is, its own
    // tool names and no renaming, for the apps' evals (app-workers.ts).
    SERVE_APP_PACKAGES?: string;
  };

export type { AppId };
