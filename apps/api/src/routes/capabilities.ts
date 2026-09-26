import { resolveAiProvider } from '../ai-provider';
import { emailEnabled } from '../email/client';
import { json, methodNotAllowed } from '../responses';
import type { RouteContext } from './context';

// GET /api/capabilities — no auth required.
// Returns which optional server-side features are configured so the
// live app can hide UI surfaces for features the operator hasn't
// provisioned. Fail-closed by design: an absent / misconfigured
// binding returns false, never true.
export function handleCapabilities(ctx: RouteContext): Response {
  const { env, request } = ctx;
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }
  return json({
    // One usable provider, resolved from whichever key is set (docs/specs/007-editor/ai-assistance.md).
    // Reports whether a provider is CONFIGURED, and deliberately says nothing
    // about whether THIS caller may use the endpoint. That asymmetry matters if
    // `AI_REQUIRE_CLERK` is ever turned on: the editor shows the AI panel on
    // `aiEnabled` alone (useEditorState -> EditorCanvasHost), so a guest would
    // get a panel that 401s on first use rather than no panel. Whoever flips
    // that flag has to make this line auth-aware in the same change — which is
    // also why production locks the endpoint down with `AI_ALLOWED_ORIGINS`
    // instead (see apps/api/wrangler.toml). Staging has the flag on today and
    // has exactly that broken panel for guests.
    aiEnabled: resolveAiProvider(env) !== null,
    // docs/specs/014-identity/profile-and-email-notifications.md: the live app hides the email-notification toggles when
    // Resend isn't configured (they'd do nothing). Same gate docs/specs/014-identity/transactional-email.md uses.
    emailEnabled: emailEnabled(env),
  });
}
