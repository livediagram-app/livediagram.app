'use client';

// This editor's OAuth pages (the consent page and the device page, docs/specs/015-api/mcp-server.md §3 and
// docs/specs/015-api/blueprints/cli.md "The device grant"), bound once: the Night Band frame (docs/specs/014-identity/
// auth-and-guest-access.md "The look: Night Band") with the connect pitch beside the card, and the facts the shared
// pages in @liveworkspace/workbench/components/oauth read.
import { CLI_CLIENT_ID } from '@livedesign/api-schema';
import type { OauthPagesConfig } from '@liveworkspace/workbench/components/oauth/oauth-chrome';
import { useSignInGate } from '@liveworkspace/workbench/hooks/auth/useSignInGate';
import { AUTH_TITLE, AuthStage } from '@/components/chrome/AuthStage';
import { ConnectPitch } from '@/components/chrome/auth-pitches';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { MCP_ORIGIN } from '@/lib/mcp-config';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { track } from '@/lib/telemetry';

export function OauthShell({ children }: { children: React.ReactNode }) {
  return <AuthStage aside={<ConnectPitch />}>{children}</AuthStage>;
}

// Sign in is offered only once the session says there is no one: the 5 s give-up is not that answer while the
// ldes_signed_in hint says a session is coming (docs/specs/014-identity/auth-and-guest-access.md).
function useOauthSignIn() {
  const { authLoaded, sessionAnswered, isSignedIn, accountUserId } = useAccountBootstrap();
  const gate = useSignInGate({
    authLoaded,
    sessionAnswered,
    signedIn: !!isSignedIn && !!accountUserId,
    signedInHint: readSignedInHint(),
  });
  return { gate, accountUserId };
}

export const OAUTH_PAGES: OauthPagesConfig = {
  product: 'livedesign',
  noun: 'designs',
  mcpOrigin: MCP_ORIGIN,
  cliClientId: CLI_CLIENT_ID,
  Shell: OauthShell,
  titleClass: AUTH_TITLE,
  useSignIn: useOauthSignIn,
  onTokenCreated: (type) => track('Token', 'Created', type === 'Cli' ? 'Cli' : 'MCP'),
};
