import { DESIGN_FORMAT } from '@livedesign/api-schema';
import { aiConfigured } from '../ai-provider';
import { emailEnabled } from '../email/client';
import { json, methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from './context';

const VERSION = /^\d+\.\d+\.\d+$/;

// What the CLI learns about a host (docs/specs/015-api/blueprints/cli.md "Capabilities", CLI9 to CLI13): where
// the api answers, whether sign-in exists, the OAuth server when it is an https origin, the design format
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
    designFormat: DESIGN_FORMAT,
    ...(minVersion && VERSION.test(minVersion) ? { cli: { minVersion } } : {}),
  };
}

// GET /api/capabilities — no auth required.
// Returns which optional server-side features are configured so the
// live app can hide UI surfaces for features the operator hasn't
// provisioned. Fail-closed by design: an absent / misconfigured
// binding returns false, never true.
export function handleCapabilities(ctx: RouteContext): Response {
  const { env, request, segments } = ctx;
  if (segments.length !== 2) return notFound();
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }
  return json({
    // A usable provider for the AI features (docs/specs/007-editor/ai-assistance.md); both features
    // resolve from the same keys, so one flag answers for both.
    // Reports whether a provider is CONFIGURED, and deliberately says nothing
    // about whether THIS caller may use the endpoint. That asymmetry matters if
    // `AI_REQUIRE_SIGN_IN` is ever turned on: the editor shows the AI panel on
    // `aiEnabled` alone (useEditorState -> EditorCanvasHost), so a guest would
    // get a panel that 401s on first use rather than no panel. Whoever flips
    // that flag has to make this line auth-aware in the same change — which is
    // also why production locks the endpoint down with `AI_ALLOWED_ORIGINS`
    // instead (see apps/api/wrangler.toml). Staging has the flag on today and
    // has exactly that broken panel for guests.
    aiEnabled: aiConfigured(env),
    // docs/specs/014-identity/profile-and-email-notifications.md: the live app hides the email-notification toggles when
    // Resend isn't configured (they'd do nothing). Same gate docs/specs/014-identity/transactional-email.md uses.
    emailEnabled: emailEnabled(env),
    ...cliCapabilities(ctx),
  });
}
