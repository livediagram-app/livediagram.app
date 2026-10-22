'use client';

// MCP OAuth consent screen (docs/specs/015-api/mcp-server.md §3). The MCP authorize endpoint redirects
// the signed-in user here with a `session` (and a display-only `client` name +
// `to` redirect host). On approve we mint an lvd_ token via the api
// (Clerk-authed) and hand it to the MCP's /oauth/complete bound to a one-time
// PKCE code, then bounce the browser to the client's redirect. Signed-in only;
// absent end-to-end without Clerk.
import { Suspense, use, useEffect, useState } from 'react';
import { browser } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { CLI_CLIENT_ID } from '@liveplanner/api-schema';
import { OAUTH_PRIMARY, OauthHelpLink, OauthShell, ReadOnlyAccessToggle } from '../oauth-shell';
import { AUTH_TITLE } from '@/components/chrome/AuthStage';
import { apiExchangeOauthToken, apiRevokeToken } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/clerk-config';
import { MCP_ORIGIN } from '@/lib/mcp-config';
import { fetchConsentSession, type McpConsentSession } from '@/lib/mcp-consent-session';
import { handoverFailureCopy, mintAndHandOver, type HandoverFailure } from '@/lib/oauth-handover';
import { track } from '@/lib/telemetry';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';

function Consent() {
  const params = useSearchParams();
  const session = params.get('session');
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error' | 'cancelled'>('idle');
  // Why the last Connect failed, for the line under the buttons.
  const [failure, setFailure] = useState<HandoverFailure>('failed');
  // Read-only opt-in (docs/specs/015-api/mcp-server.md §4.11): grant the tool view-only access — it can
  // find and read projects but not create / edit / delete / share.
  const [readOnly, setReadOnly] = useState(false);
  // The SERVER's account of this authorize request. Deliberately not the
  // `client` / `to` query params the redirect also carries: those are writable
  // by whoever sends the user here, and this screen's whole job is telling the
  // user WHERE a full-access token is about to go. `undefined` while the
  // lookup is in flight, `null` once it failed. See lib/mcp-consent-session.ts.
  const [fetched, setFetched] = useState<McpConsentSession | null | undefined>(undefined);
  // A missing `session` is not a lookup that failed, it's one that never ran —
  // so it's derived here rather than written into state from the effect (which
  // would be a synchronous setState during render's effect pass).
  const resolved = session ? fetched : null;

  useEffect(() => {
    if (!session) return;
    let live = true;
    void fetchConsentSession(session).then((s) => {
      if (live) setFetched(s);
    });
    return () => {
      live = false;
    };
  }, [session]);

  // Only ever the server's name. Used in the headings AND as the token's label
  // at /api/oauth/exchange, so the Explorer's token list later names the same
  // client the user actually approved.
  const client = resolved?.clientName ?? 'An application';

  // Checked first so Cancel works from any state (incl. the sign-in screen,
  // which otherwise returns before the later checks).
  if (status === 'cancelled') {
    return (
      <OauthShell>
        <h1 className={AUTH_TITLE}>Connection cancelled</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You can close this window.
        </p>
      </OauthShell>
    );
  }

  if (!clerkEnabled) {
    return (
      <OauthShell>
        <h1 className={AUTH_TITLE}>Connecting apps isn’t available</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This deployment doesn’t have accounts enabled, so there’s nothing to connect to.
        </p>
      </OauthShell>
    );
  }
  if (!authLoaded) {
    return (
      <OauthShell>
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </OauthShell>
    );
  }
  if (!isSignedIn || !clerkUserId) {
    // Return here after sign-in. The sign-in page reads `redirect_url` (NOT
    // `redirect`) and validates it as a safe internal path before bouncing
    // back — /oauth/consent?... qualifies, so the user lands back on consent.
    // The browser's own address: this branch renders in the browser only (`use(browser())`, under the page's Suspense).
    use(browser());
    const back = window.location.pathname + window.location.search;
    return (
      <OauthShell>
        <h1 className={AUTH_TITLE}>Sign in to connect {client}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          You need to be signed in to connect an app to your projects.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <a
            href={`/sign-in/?redirect_url=${encodeURIComponent(back)}`}
            className={`inline-flex ${OAUTH_PRIMARY}`}
          >
            Sign in
          </a>
          <button
            type="button"
            onClick={() => setStatus('cancelled')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
        <div>
          <OauthHelpLink />
        </div>
      </OauthShell>
    );
  }
  // The lookup is still in flight. Deliberately a blocking state rather than
  // rendering the screen with placeholders: an approve button shown before the
  // destination is known is exactly the screen this lookup exists to prevent.
  if (resolved === undefined) {
    return (
      <OauthShell>
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking this request…</p>
      </OauthShell>
    );
  }
  // No session in the URL, or the server doesn't recognise it (expired — they
  // last 10 minutes — or never existed). One message for all three: the fix is
  // the same, and naming which one would confirm session ids to a prober.
  if (resolved === null) {
    return (
      <OauthShell>
        <h1 className={AUTH_TITLE}>This link has expired</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          We couldn’t find the connection request this link points to. Start the connection again
          from your app.
        </p>
        <div>
          <OauthHelpLink />
        </div>
      </OauthShell>
    );
  }

  const approve = async () => {
    if (!session) return;
    setStatus('connecting');
    // Checks the session is still live before minting, and revokes a token the MCP did not take, so a failed
    // Connect never leaves a six-month token behind (lib/oauth-handover.ts).
    const result = await mintAndHandOver({
      sessionLive: async () => (await fetchConsentSession(session)) !== null,
      mint: () => apiExchangeOauthToken(clerkUserId, client, readOnly),
      complete: async (token, expiresAt) => {
        const res = await fetch(`${MCP_ORIGIN}/oauth/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session, token, expiresAt }),
        });
        if (!res.ok) return null;
        const { redirectTo } = (await res.json()) as { redirectTo: string };
        return redirectTo;
      },
      revoke: (id) => apiRevokeToken(clerkUserId, id),
    });
    if (!result.ok) {
      setFailure(result.reason);
      setStatus('error');
      return;
    }
    // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): an app was connected, which mints a token.
    // `type` is the fixed source, never the client name: the CLI by its public client id (CLI77), else an MCP
    // client.
    track('Token', 'Created', resolved.clientId === CLI_CLIENT_ID ? 'Cli' : 'MCP');
    try {
      // Only ever navigate to an http(s) URL: a `javascript:` target would run
      // as script on this origin with the signed-in session.
      const target = new URL(result.value);
      if (target.protocol !== 'https:' && target.protocol !== 'http:') {
        throw new Error('unsafe redirect');
      }
      window.location.href = target.toString();
    } catch {
      setFailure('failed');
      setStatus('error');
    }
  };

  return (
    <OauthShell>
      <h1 className={AUTH_TITLE}>Connect {client}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-200">{client}</span> wants to
        access your liveplanner projects on your behalf. Approving creates an API token, which you
        can revoke any time from Settings, under Account › API Tokens.
      </p>
      <ReadOnlyAccessToggle readOnly={readOnly} onChange={setReadOnly} />
      {/* The one fact worth checking before approving, and now the server's
          answer rather than the URL's: the host the authorization code is
          delivered to, read off the redirect URI this client registered. */}
      {resolved.redirectHost ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          Access will be sent to{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {resolved.redirectHost}
          </span>
          . Only continue if you recognise this.
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">
          {handoverFailureCopy(failure, 'Start the connection again from your app.')}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void approve()}
          disabled={status === 'connecting'}
          className={OAUTH_PRIMARY}
        >
          {status === 'connecting' ? 'Connecting…' : 'Connect'}
        </button>
        <button
          type="button"
          onClick={() => setStatus('cancelled')}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
      <div>
        <OauthHelpLink />
      </div>
    </OauthShell>
  );
}

export default function OauthConsentPage() {
  return (
    <Suspense
      fallback={
        <OauthShell>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </OauthShell>
      }
    >
      <Consent />
    </Suspense>
  );
}
