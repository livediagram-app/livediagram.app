'use client';

// Device sign-in (docs/specs/015-api/blueprints/cli.md "The device grant", "Presentation and UX", CLI36, CLI37): the
// CLI on a machine without a browser shows a code; the person opens this page anywhere, signs in, enters the code
// and approves. On approve the page mints an API token (signed-in, as the consent page does) and hands it to the
// MCP worker for the waiting CLI to collect; on cancel it refuses the code, so the CLI stops waiting. No help link:
// the CLI's own README documents it.
import { Suspense, use, useState } from 'react';
import { browser } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { apiExchangeOauthToken, apiRevokeTokenAsItself } from '@/lib/api-client';
import {
  completeDevice,
  denyDevice,
  fetchDeviceSession,
  userCodeOf,
} from '@/lib/mcp-device-session';
import {
  handoverFailureCopy,
  mintAndHandOver,
  type HandoverFailure,
} from '@liveworkspace/workbench/lib/oauth-handover';
import { track } from '@/lib/telemetry';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { useSignInGate } from '@liveworkspace/workbench/hooks/auth/useSignInGate';
import { OAUTH_PRIMARY, OauthShell, ReadOnlyAccessToggle } from '../oauth-shell';
import { AUTH_TITLE } from '@/components/chrome/AuthStage';

type Step =
  | { kind: 'enter' }
  | { kind: 'checking' }
  | { kind: 'unknown' }
  | {
      kind: 'consent';
      userCode: string;
      clientName: string;
      working: boolean;
      // Why the last Connect failed, or null before one has.
      failed: HandoverFailure | null;
    }
  | { kind: 'done' }
  | { kind: 'cancelled' };

const SECONDARY =
  'rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
const HEADING = AUTH_TITLE;
const BODY = 'mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400';

function Message({ heading, body }: { heading: string; body: string }) {
  return (
    <OauthShell>
      <h1 className={HEADING}>{heading}</h1>
      <p className={BODY}>{body}</p>
    </OauthShell>
  );
}

function Device() {
  const params = useSearchParams();
  const { authLoaded, sessionAnswered, isSignedIn, accountUserId } = useAccountBootstrap();
  // Sign in is offered only once the session says there is no one: the 5 s give-up is not that answer while
  // the ld_signed_in hint says a session is coming (docs/specs/014-identity/auth-and-guest-access.md).
  const gate = useSignInGate({
    authLoaded,
    sessionAnswered,
    signedIn: !!isSignedIn && !!accountUserId,
    signedInHint: readSignedInHint(),
  });
  const [typed, setTyped] = useState(params.get('code') ?? '');
  const [step, setStep] = useState<Step>({ kind: 'enter' });
  const [readOnly, setReadOnly] = useState(false);

  // Cancel refuses the code when there is one, so the terminal stops waiting.
  const cancel = async () => {
    const userCode = step.kind === 'consent' ? step.userCode : userCodeOf(typed);
    if (userCode) await denyDevice(userCode);
    setStep({ kind: 'cancelled' });
  };

  if (step.kind === 'cancelled')
    return <Message heading="Connection cancelled" body="Your terminal will stop waiting." />;
  if (gate === 'waiting')
    return (
      <OauthShell>
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </OauthShell>
    );
  if (gate === 'sign-in' || !accountUserId) {
    // The browser's own address: this branch renders in the browser only (`use(browser())`, under the page's Suspense).
    use(browser());
    const back = window.location.pathname + window.location.search;
    return (
      <OauthShell>
        <h1 className={HEADING}>Sign in to connect the livediagram CLI</h1>
        <div className="mt-5 flex items-center gap-2">
          <a
            href={`/sign-in/?redirect_url=${encodeURIComponent(back)}`}
            className={`inline-flex ${OAUTH_PRIMARY}`}
          >
            Sign in
          </a>
          <button type="button" onClick={() => void cancel()} className={SECONDARY}>
            Cancel
          </button>
        </div>
      </OauthShell>
    );
  }

  const check = async () => {
    const userCode = userCodeOf(typed);
    setStep({ kind: 'checking' });
    const session = userCode ? await fetchDeviceSession(userCode) : null;
    setStep(
      userCode && session
        ? {
            kind: 'consent',
            userCode,
            clientName: session.clientName,
            working: false,
            failed: null,
          }
        : { kind: 'unknown' },
    );
  };

  const approve = async (userCode: string, clientName: string) => {
    setStep({ kind: 'consent', userCode, clientName, working: true, failed: null });
    // Checks the code is still waiting before minting, and revokes a token the MCP did not take, so a failed
    // Connect never leaves a six-month token behind (@liveworkspace/workbench/lib/oauth-handover.ts).
    const result = await mintAndHandOver({
      sessionLive: async () => (await fetchDeviceSession(userCode)) !== null,
      mint: () => apiExchangeOauthToken(accountUserId, clientName, readOnly),
      complete: async (token, expiresAt) =>
        (await completeDevice(userCode, token, expiresAt)) ? true : null,
      revoke: (token) => apiRevokeTokenAsItself(token),
    });
    if (!result.ok) {
      setStep({ kind: 'consent', userCode, clientName, working: false, failed: result.reason });
      return;
    }
    // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): the CLI signed in, which mints a token.
    track('Token', 'Created', 'Cli');
    setStep({ kind: 'done' });
  };

  switch (step.kind) {
    case 'done':
      return (
        <Message
          heading="You’re connected"
          body="Return to your terminal; it carries on by itself."
        />
      );
    case 'checking':
      return (
        <OauthShell>
          <p className="text-sm text-slate-500 dark:text-slate-400">Checking this code…</p>
        </OauthShell>
      );
    case 'unknown':
      return (
        <OauthShell>
          <h1 className={HEADING}>We couldn’t find that code yet</h1>
          <p className={BODY}>Check it and try again. Codes last 10 minutes.</p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setStep({ kind: 'enter' })}
              className={OAUTH_PRIMARY}
            >
              Try again
            </button>
          </div>
        </OauthShell>
      );
    case 'consent': {
      const { userCode, clientName, working, failed } = step;
      return (
        <OauthShell>
          <h1 className={HEADING}>Connect {clientName}</h1>
          <p className={BODY}>
            <span className="font-medium text-slate-700 dark:text-slate-200">{clientName}</span>{' '}
            wants to act as you in your liveworkspace apps, livediagram among them. Approving
            creates an API token for your liveworkspace account, which you can revoke any time on
            liveworkspace.app.
          </p>
          <ReadOnlyAccessToggle readOnly={readOnly} onChange={setReadOnly} />
          {failed ? (
            <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">
              {handoverFailureCopy(failed, 'Run the sign-in again from your terminal.')}
            </p>
          ) : null}
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void approve(userCode, clientName)}
              disabled={working}
              className={OAUTH_PRIMARY}
            >
              {working ? 'Connecting…' : 'Connect'}
            </button>
            <button type="button" onClick={() => void cancel()} className={SECONDARY}>
              Cancel
            </button>
          </div>
        </OauthShell>
      );
    }
    default:
      return (
        <OauthShell>
          <h1 className={HEADING}>Connect a terminal</h1>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void check();
            }}
          >
            <label
              htmlFor="device-code"
              className="text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Code shown in your terminal
            </label>
            <input
              id="device-code"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={9}
              placeholder="XXXX-XXXX"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base tracking-widest text-slate-900 uppercase focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only enter a code shown by a terminal you are using.
            </p>
            <div>
              <button type="submit" className={OAUTH_PRIMARY}>
                Continue
              </button>
            </div>
          </form>
        </OauthShell>
      );
  }
}

export default function OauthDevicePage() {
  return (
    <Suspense
      fallback={
        <OauthShell>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </OauthShell>
      }
    >
      <Device />
    </Suspense>
  );
}
