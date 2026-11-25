'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BackBar, Button, usePageRestore } from '@liveworkspace/ui';
import { OauthHelpLink, ReadOnlyAccessToggle, OauthWarning } from './oauth/oauth-chrome';
import { TokenLimitListLazy } from './oauth/TokenLimitListLazy';
import { Callout } from '@liveworkspace/ui/callout';
import { accountApi } from '@/lib/account-api';
import { trackMcpTokenCreated } from '@/lib/explorer/telemetry';
import { signInHref } from '@/lib/accounts';
import { listedApps } from '@/lib/apps';
import { useLocationSearch } from '@/lib/location-search';
import {
  MCP_APPS,
  cancelConnect,
  connect,
  fetchConsentSession,
  handOverError,
  mcpOrigin,
  opensApp,
  type ConsentSession,
  type McpApp,
} from '@/lib/mcp-connect';
import { useSession } from '@/lib/session';
import { AppMark } from '../landing/AppLogo';
import {
  AccountCard,
  AccountHeading,
  Alert,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from './AccountPage';
import { ConnectPitch } from './Pitch';

// Connecting an AI tool to every app at once (liveworkspace/docs/specs/021-mcp/mcp.md "Sign-in and per-app
// consent"): the one MCP's /oauth/authorize sends the person here. The pieces it shares with the device page
// (./oauth: the Unverified App warning, where access goes, read-only, the help link) beside the connect pitch, plus
// the apps it may use, every one ticked to start. A CLI signing in sees no app list: its token goes to one app's api.
export function McpConsent() {
  return (
    <>
      {/* The card first; the pitch shows beside it from lg only. */}
      <ConsentCard />
      <ConnectPitch />
    </>
  );
}

function ConsentCard() {
  const session = new URLSearchParams(useLocationSearch()).get('session');
  const signedIn = useSession();
  const [request, setRequest] = useState<ConsentSession | null | undefined>(undefined);
  const [ticked, setTicked] = useState<ReadonlySet<McpApp>>(
    () => new Set(MCP_APPS.map((a) => a.app)),
  );
  const [readOnly, setReadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  // Handed to an app on this computer (an app scheme such as cursor://): the browser stays on this page, so it says so.
  const [handedToApp, setHandedToApp] = useState(false);
  // At the token cap: the account's tokens are listed to revoke one in place (`atLimit`), and once one is, the card
  // says there is room and the keyboard goes to Connect (`freed`), as on each app's consent page.
  const [atLimit, setAtLimit] = useState(false);
  const [freed, setFreed] = useState(false);
  const connectRef = useRef<HTMLButtonElement>(null);
  // Busy until the browser has left (busy-buttons.md); Back into the kept page makes Connect pressable again.
  usePageRestore(() => setBusy(false));

  const origin = useMemo(
    () => (typeof window === 'undefined' ? '' : mcpOrigin(window.location)),
    [],
  );
  const apps = useMemo(() => {
    const listed = listedApps();
    return MCP_APPS.map((a) => ({ ...a, listed: listed.find((l) => l.id === a.site) ?? null }));
  }, []);

  useEffect(() => {
    if (!session || !origin) return;
    let live = true;
    void fetchConsentSession(origin, session).then((found) => {
      if (live) setRequest(found);
    });
    return () => {
      live = false;
    };
  }, [origin, session]);

  // On a phone the token step opens below the pitch: bring its top into view rather than leaving the reader mid-page.
  useEffect(() => {
    if (!atLimit) return;
    const step = document.getElementById('mcp-consent-step');
    if (step && step.getBoundingClientRect().top < 0) step.scrollIntoView({ block: 'start' });
  }, [atLimit]);

  if (handedToApp)
    return (
      <AccountCard narrow>
        <AccountHeading title="Connected">
          Your AI tool should open to finish. You can close this window.
        </AccountHeading>
      </AccountCard>
    );

  if (cancelled)
    return (
      <AccountCard narrow>
        <AccountHeading title="Connection cancelled">You can close this window.</AccountHeading>
      </AccountCard>
    );

  if (signedIn.state === 'checking' || (session && request === undefined))
    return (
      <AccountCard narrow>
        <p className="text-sm text-slate-600 dark:text-slate-400">Checking this request…</p>
      </AccountCard>
    );

  if (!session || !request)
    return (
      <AccountCard narrow>
        <AccountHeading title="This link has expired">
          Start the connection again from your AI tool.
        </AccountHeading>
        <OauthHelpLink />
      </AccountCard>
    );

  const client = request.clientName;

  // Cancel tells the AI tool, which is otherwise left waiting: the browser goes back to it with access_denied.
  const cancel = async () => {
    setBusy(true);
    const redirectTo = await cancelConnect(origin, session);
    if (redirectTo) {
      window.location.assign(redirectTo);
      if (!opensApp(redirectTo)) return;
    }
    setBusy(false);
    setCancelled(true);
  };

  if (signedIn.state === 'out')
    return (
      <AccountCard narrow>
        <AccountHeading title={`Sign in to connect ${client}`}>
          Sign in to connect it to your apps.
        </AccountHeading>
        <a
          href={signInHref(window.location.pathname + window.location.search)}
          className={`flex items-center justify-center ${PRIMARY_BUTTON}`}
        >
          Sign in
        </a>
        <div className="mt-2 flex">
          <Button variant="none" onClick={() => void cancel()} className={SECONDARY_BUTTON}>
            Cancel
          </Button>
        </div>
        <OauthHelpLink />
      </AccountCard>
    );

  const toggle = (app: McpApp) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(app)) next.delete(app);
      else next.add(app);
      return next;
    });

  const approve = async () => {
    setError('');
    setFreed(false);
    setBusy(true);
    // A CLI gets every app: it calls one app's api with the token, never this MCP's tools.
    const chosen = MCP_APPS.map((a) => a.app).filter((app) => request.cli || ticked.has(app));
    const result = await connect(origin, session, client, chosen, readOnly);
    if (result.ok) {
      // Anonymous telemetry: an AI tool connected, or a CLI signed in, which mints a token.
      trackMcpTokenCreated(request.cli ? 'Cli' : 'MCP');
      window.location.assign(result.redirectTo);
      if (opensApp(result.redirectTo)) {
        setBusy(false);
        setHandedToApp(true);
      }
      return;
    }
    setBusy(false);
    if (result.reason === 'token_limit') setAtLimit(true);
    setError(handOverError(result.reason));
  };

  // Two steps, so the card stays short: the apps and access first; at the token cap, a step of its own in their place
  // (the breadcrumb back keeps every tick and the read-only choice), the cap's alert where the destination warning
  // was, and the tokens to revoke.
  const room = atLimit;
  const backToApps = () => {
    setAtLimit(false);
    setFreed(false);
    setError('');
  };

  return (
    <AccountCard narrow>
      {room ? (
        <div id="mcp-consent-step" className="scroll-mt-20">
          <BackBar label="Back to apps" current="Make room" onClick={backToApps} disabled={busy} />
        </div>
      ) : null}
      <AccountHeading title={`Connect ${client}`}>
        {/* The client's name is the client's own choice: isolated, and wrapped rather than leaving the card. */}
        <strong className="break-all text-slate-900 dark:text-slate-100">
          <bdi>{client}</bdi>
        </strong>{' '}
        {request.cli
          ? 'wants to act as you in your liveworkspace apps from your terminal. Revoke it any time in Settings.'
          : 'wants access to your liveworkspace apps. Revoke it any time in Settings.'}
      </AccountHeading>
      {room ? (
        <>
          {freed ? (
            <Callout tone="success" role="status">
              There’s room now. Choose Connect.
            </Callout>
          ) : (
            <Alert tone="error">{error}</Alert>
          )}
          <TokenLimitListLazy
            request={accountApi}
            onFreed={() => {
              setFreed(true);
              connectRef.current?.focus();
            }}
          />
        </>
      ) : (
        <>
          {request.verified ? (
            request.redirectHost ? (
              <Callout tone="info" className="mt-3">
                Access goes to <strong>{request.redirectHost}</strong>.
              </Callout>
            ) : null
          ) : (
            <OauthWarning title={`${client} isn’t made by liveworkspace.`}>
              {request.localScheme ? (
                // An app scheme (mcp.md "Redirect addresses"): any app on this computer can claim it.
                <p>
                  Access goes to an app on this computer that opens{' '}
                  <strong className="break-words font-mono">{request.localScheme}://</strong> links.
                  Any app here can claim those links, so only continue if you just started this in{' '}
                  <bdi>{client}</bdi>.
                </p>
              ) : (
                <p>
                  {request.redirectHost ? (
                    <>
                      Access goes to{' '}
                      <strong className="break-all font-mono">{request.redirectHost}</strong>.{' '}
                    </>
                  ) : null}
                  Only continue if you started this.
                </p>
              )}
            </OauthWarning>
          )}
          {request.cli ? null : (
            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Apps it can use
              </legend>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                {apps.map((a) => (
                  <li key={a.app}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={ticked.has(a.app)}
                        onChange={() => toggle(a.app)}
                        className="size-4 cursor-pointer accent-slate-900 dark:accent-slate-100"
                      />
                      {a.listed ? <AppMark app={a.listed} className="size-6 shrink-0" /> : null}
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {a.app}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {a.makes}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          <ReadOnlyAccessToggle
            noun="items"
            readOnly={readOnly}
            onChange={setReadOnly}
            line="view your items, but not change them."
          />
          {error ? (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}
        </>
      )}
      <div className="mt-5 flex gap-2">
        <Button
          variant="none"
          onClick={() => void cancel()}
          disabled={busy}
          className={SECONDARY_BUTTON}
        >
          Cancel
        </Button>
        <Button
          ref={connectRef}
          variant="none"
          onClick={() => void approve()}
          busy={busy}
          disabled={!request.cli && ticked.size === 0}
          title={!request.cli && ticked.size === 0 ? 'Tick at least one app' : undefined}
          className={PRIMARY_BUTTON}
        >
          {busy ? 'Connecting…' : 'Connect'}
        </Button>
      </div>
      <OauthHelpLink />
    </AccountCard>
  );
}
