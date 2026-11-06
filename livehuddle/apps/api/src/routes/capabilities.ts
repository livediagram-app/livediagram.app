import { DOCUMENT_FORMAT } from '@livehuddle/api-schema';
import { callsGate } from '../calls/calls-gate';
import { communityEnabled } from '../community-enabled';
import { communityServiceConfigured } from '../community-service';
import { emailEnabled } from '../email/client';
import { json, methodNotAllowed, notFound } from '../responses';
import type { RouteContext } from './context';

// What a script learns about a host (docs/specs/015-api/api.md "Capabilities"): where the api answers, whether
// sign-in exists, and the document format stored.
function hostCapabilities({ env, url }: RouteContext) {
  return {
    apiBase: `${url.origin}/api`,
    authEnabled: Boolean(env.ACCOUNTS_URL && env.API_RESOURCE),
    documentFormat: DOCUMENT_FORMAT,
  };
}

// GET /api/capabilities — no auth required.
// Returns which optional server-side features are configured so the
// editor app can hide UI surfaces for features the operator hasn't
// provisioned. Fail-closed by design: an absent / misconfigured
// binding returns false, never true.
export async function handleCapabilities(ctx: RouteContext): Promise<Response> {
  const { env, request, segments } = ctx;
  if (segments.length !== 2) return notFound();
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }
  const calls = await callsGate(env);
  return json({
    // docs/specs/014-identity/profile-and-email-notifications.md: the editor app hides the email-notification toggles when
    // the deployment has no EMAIL binding (they'd do nothing). Same gate docs/specs/014-identity/transactional-email.md uses.
    emailEnabled: emailEnabled(env),
    // docs/specs/025-community/community.md "Turning the Community off": false hides the Community from every app. A
    // deploy without the liveworkspace Community service's key has none to show (by default).
    communityEnabled: communityEnabled(env) && communityServiceConfigured(env),
    // docs/specs/012-collaboration/proximity-audio.md "Turning calls on": the calls gate the mint route asks. A
    // deployment with calls shows the audio controls even while the kill switch pauses them (Calls Paused), so
    // `callsMode` says which (docs/specs/016-platform/calls-kill-switch.md "Calls Paused").
    callsEnabled: calls.open || calls.reason === 'paused',
    ...(calls.open
      ? { callsMode: calls.mode }
      : calls.reason === 'paused'
        ? { callsMode: 'off' as const }
        : {}),
    ...hostCapabilities(ctx),
  });
}
