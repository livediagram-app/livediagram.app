'use client';

// MCP OAuth consent screen (docs/specs/015-api/mcp-server.md §3). The MCP authorize endpoint redirects the signed-in
// user here with a `session` (and a display-only `client` name + `to` redirect host, which this page never reads). On
// approve it mints an lwt_ token via the api (signed-in) and hands it to the MCP's /oauth/complete bound to a one-time
// PKCE code, then bounces the browser to the client's redirect. Signed-in only.
//
// Registration is open, so a client's name is whatever it sent: every client that is not built in wears an
// Unverified App badge, says it is not made by liveworkspace, and shows the host its access goes to first.
import { Suspense, use, useEffect, useState } from 'react';
import { browser } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { Button } from '@liveworkspace/ui';
import { apiExchangeOauthToken } from '../../lib/api/oauth';
import { apiRevokeTokenAsItself } from '../../lib/api/tokens';
import { fetchConsentSession, type McpConsentSession } from '../../lib/mcp-consent-session';
import {
  handoverFailureCopy,
  mintAndHandOver,
  type HandoverFailure,
} from '../../lib/oauth-handover';
import {
  OAUTH_BODY,
  OAUTH_PRIMARY,
  OAUTH_QUIET,
  OAUTH_SECONDARY,
  OauthHelpLink,
  OauthWarning,
  ReadOnlyAccessToggle,
  UnverifiedAppBadge,
  type OauthPagesConfig,
} from './oauth-chrome';

// Where the access goes, for a client the server vouches for (the product's CLI): the quiet line.
function VerifiedDestination({ host }: { host: string }) {
  return (
    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
      Access will be sent to{' '}
      <span className="font-medium text-slate-700 dark:text-slate-200">{host}</span>. Only continue
      if you recognise this.
    </p>
  );
}

// Where the access goes, for any other client: the card's first fact, with whose app this is not.
function UnverifiedDestination({ client, host }: { client: string; host: string }) {
  return (
    <OauthWarning title={`${client} is not made by liveworkspace, and we can’t check who made it.`}>
      {host ? (
        <p>
          Access will be sent to{' '}
          <span className="font-mono text-sm font-semibold break-all text-slate-900 dark:text-white">
            {host}
          </span>
          . Only continue if you recognise this site and started this connection yourself.
        </p>
      ) : (
        <p>Only continue if you started this connection yourself.</p>
      )}
    </OauthWarning>
  );
}

function Consent({ config }: { config: OauthPagesConfig }) {
  const { Shell, titleClass, product, noun, mcpOrigin } = config;
  const params = useSearchParams();
  const session = params.get('session');
  const { gate, accountUserId } = config.useSignIn();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error' | 'cancelled'>('idle');
  // Why the last Connect failed, for the line under the buttons.
  const [failure, setFailure] = useState<HandoverFailure>('failed');
  // Read-only opt-in (docs/specs/015-api/mcp-server.md §4.11): grant the tool view-only access.
  const [readOnly, setReadOnly] = useState(false);
  // The SERVER's account of this authorize request. Deliberately not the `client` / `to` query params the redirect
  // also carries: those are writable by whoever sends the user here, and this screen's whole job is telling the user
  // WHERE a full-access token is about to go. `undefined` while the lookup is in flight, `null` once it failed.
  const [fetched, setFetched] = useState<McpConsentSession | null | undefined>(undefined);
  // A missing `session` is not a lookup that failed, it's one that never ran, so it's derived here rather than
  // written into state from the effect.
  const resolved = session ? fetched : null;

  useEffect(() => {
    if (!session) return;
    let live = true;
    void fetchConsentSession(mcpOrigin, session).then((s) => {
      if (live) setFetched(s);
    });
    return () => {
      live = false;
    };
  }, [mcpOrigin, session]);

  // Only ever the server's name. Used in the headings AND as the token's label at /api/oauth/exchange, so the
  // token list later names the same client the user actually approved.
  const client = resolved?.clientName ?? 'An application';
  const cancelButton = (
    <button type="button" onClick={() => setStatus('cancelled')} className={OAUTH_SECONDARY}>
      Cancel
    </button>
  );

  // Checked first so Cancel works from any state (incl. the sign-in screen, which otherwise returns before the later
  // checks).
  if (status === 'cancelled') {
    return (
      <Shell>
        <h1 className={titleClass}>Connection cancelled</h1>
        <p className={OAUTH_BODY}>You can close this window.</p>
      </Shell>
    );
  }

  if (gate === 'waiting') {
    return (
      <Shell>
        <p className={OAUTH_QUIET}>Loading…</p>
      </Shell>
    );
  }
  if (gate === 'sign-in' || !accountUserId) {
    // Return here after sign-in. The sign-in page reads `redirect_url` (NOT `redirect`) and validates it as a safe
    // internal path before bouncing back; /oauth/consent?... qualifies, so the user lands back on consent.
    // The browser's own address: this branch renders in the browser only (`use(browser())`, under the page's Suspense).
    use(browser());
    const back = window.location.pathname + window.location.search;
    return (
      <Shell>
        <h1 className={titleClass}>Sign in to connect {client}</h1>
        <p className={OAUTH_BODY}>You need to be signed in to connect an app to your {noun}.</p>
        <div className="mt-5 flex items-center gap-2">
          <a
            href={`/sign-in/?redirect_url=${encodeURIComponent(back)}`}
            className={`inline-flex ${OAUTH_PRIMARY}`}
          >
            Sign in
          </a>
          {cancelButton}
        </div>
        <div>
          <OauthHelpLink />
        </div>
      </Shell>
    );
  }
  // The lookup is still in flight. Deliberately a blocking state rather than the screen with placeholders: an
  // approve button shown before the destination is known is exactly the screen this lookup exists to prevent.
  if (resolved === undefined) {
    return (
      <Shell>
        <p className={OAUTH_QUIET}>Checking this request…</p>
      </Shell>
    );
  }
  // No session in the URL, or the server doesn't recognise it (expired, they last 10 minutes, or never existed).
  // One message for all three: the fix is the same, and naming which one would confirm session ids to a prober.
  if (resolved === null || !session) {
    return (
      <Shell>
        <h1 className={titleClass}>This link has expired</h1>
        <p className={OAUTH_BODY}>
          We couldn’t find the connection request this link points to. Start the connection again
          from your app.
        </p>
        <div>
          <OauthHelpLink />
        </div>
      </Shell>
    );
  }

  const approve = async () => {
    setStatus('connecting');
    // Checks the session is still live before minting, and revokes a token the MCP did not take, so a failed
    // Connect never leaves a six-month token behind (lib/oauth-handover.ts).
    const result = await mintAndHandOver({
      sessionLive: async () => (await fetchConsentSession(mcpOrigin, session)) !== null,
      mint: () => apiExchangeOauthToken(accountUserId, client, readOnly),
      complete: async (token, expiresAt) => {
        const res = await fetch(`${mcpOrigin}/oauth/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session, token, expiresAt }),
        });
        if (!res.ok) return null;
        const { redirectTo } = (await res.json()) as { redirectTo: string };
        return redirectTo;
      },
      revoke: (token) => apiRevokeTokenAsItself(token),
    });
    if (!result.ok) {
      setFailure(result.reason);
      setStatus('error');
      return;
    }
    // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): an app was connected, which mints a token. `type`
    // is the fixed source, never the client name: the CLI by its public client id (CLI77), else an MCP client.
    config.onTokenCreated(resolved.clientId === config.cliClientId ? 'Cli' : 'MCP');
    try {
      // Only ever navigate to an http(s) URL: a `javascript:` target would run as script on this origin with the
      // signed-in session.
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
    <Shell>
      <h1 className={titleClass}>Connect {client}</h1>
      {resolved.verified ? null : (
        <>
          <div className="mt-2">
            <UnverifiedAppBadge />
          </div>
          <UnverifiedDestination client={client} host={resolved.redirectHost} />
        </>
      )}
      <p className={OAUTH_BODY}>
        <span className="font-medium text-slate-700 dark:text-slate-200">{client}</span> wants to
        act as you in your liveworkspace apps, {product} among them. Approving creates an API token
        for your liveworkspace account, which you can revoke any time on liveworkspace.app.
      </p>
      <ReadOnlyAccessToggle noun={noun} readOnly={readOnly} onChange={setReadOnly} />
      {/* The one fact worth checking before approving, and the server's answer rather than the URL's: the host the
          authorization code is delivered to, read off the redirect URI this client registered. */}
      {resolved.verified && resolved.redirectHost ? (
        <VerifiedDestination host={resolved.redirectHost} />
      ) : null}
      {status === 'error' ? (
        <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">
          {handoverFailureCopy(failure, 'Start the connection again from your app.')}
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-2">
        {/* Keeps the keyboard while it connects (busy-buttons.md); a failure's alert is then beside it. */}
        <Button
          variant="none"
          onClick={() => void approve()}
          busy={status === 'connecting'}
          className={OAUTH_PRIMARY}
        >
          {status === 'connecting' ? 'Connecting…' : 'Connect'}
        </Button>
        {cancelButton}
      </div>
      <div>
        <OauthHelpLink />
      </div>
    </Shell>
  );
}

/** An editor's /oauth/consent page, bound to its facts once (its app/oauth/consent/page.tsx). */
export function createOauthConsentPage(config: OauthPagesConfig) {
  const { Shell } = config;
  return function OauthConsentPage() {
    return (
      <Suspense
        fallback={
          <Shell>
            <p className={OAUTH_QUIET}>Loading…</p>
          </Shell>
        }
      >
        <Consent config={config} />
      </Suspense>
    );
  };
}
