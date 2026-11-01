import { DOCUMENT_FORMAT } from '@livediagram/api-schema';
import { aiConfigured } from '../ai-provider';
import { communityEnabled } from '../community-enabled';
import { communityServiceConfigured } from '../community-service';
import { emailEnabled } from '../email/client';
import { json, methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from './context';

const VERSION = /^\d+\.\d+\.\d+$/;

// What the CLI learns about a host (docs/specs/015-api/blueprints/cli.md "Capabilities", CLI9 to CLI13): where
// the api answers, whether sign-in exists, the OAuth server when it is an https origin, the document format
// stored, and the version floor when one is set.
function cliCapabilities({ env, url }: RouteContext) {
  const issuer = (() => {
    try {
      const parsed = env.OAUTH_ISSUER ? new URL(env.OAUTH_ISSUER) : null;
      return parsed?.protocol === 'https:' ? parsed.origin : undefined;
    } catch {
      return undefined;
    }
  })();
  const minVersion = env.CLI_MIN_VERSION?.trim();
  return {
    apiBase: `${url.origin}/api`,
    authEnabled: Boolean(env.ACCOUNTS_URL && env.API_RESOURCE),
    ...(issuer ? { oauthIssuer: issuer } : {}),
    documentFormat: DOCUMENT_FORMAT,
    ...(minVersion && VERSION.test(minVersion) ? { cli: { minVersion } } : {}),
  };
}

// GET /api/capabilities — no auth required.
// Returns which optional server-side features are configured so the
// editor app can hide UI surfaces for features the operator hasn't
// provisioned. Fail-closed by design: an absent / misconfigured
// binding returns false, never true.
export function handleCapabilities(ctx: RouteContext): Response {
  const { env, request, segments } = ctx;
  if (segments.length !== 2) return notFound();
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }
  return json({
    // A usable provider for the sticky-note photo reader
    // (docs/specs/021-event-storming/note-reader.md).
    // Reports whether a provider is CONFIGURED, and deliberately says nothing
    // about whether THIS caller may use the endpoint. That asymmetry matters if
    // `AI_REQUIRE_SIGN_IN` is turned on: the editor picks the server reader on
    // `aiEnabled` alone, so a guest's read is refused 401 rather than read in
    // the browser. Whoever relies on that flag should make this line
    // auth-aware in the same change — which is also why production locks the
    // endpoint down with `AI_ALLOWED_ORIGINS` instead (see apps/api/wrangler.toml).
    aiEnabled: aiConfigured(env),
    // docs/specs/014-identity/profile-and-email-notifications.md: the editor app hides the email-notification toggles when
    // the deployment has no EMAIL binding (they'd do nothing). Same gate docs/specs/014-identity/transactional-email.md uses.
    emailEnabled: emailEnabled(env),
    // docs/specs/025-community/community.md "Turning the Community off": false hides the Community from every app. A
    // deploy without the liveworkspace Community service's key has none to show (by default).
    communityEnabled: communityEnabled(env) && communityServiceConfigured(env),
    ...cliCapabilities(ctx),
  });
}
