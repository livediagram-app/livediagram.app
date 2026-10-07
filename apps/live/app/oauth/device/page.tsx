'use client';

// Device sign-in (docs/specs/015-api/blueprints/cli.md "The device grant", "Presentation and UX", CLI36, CLI37): the
// CLI on a machine without a browser shows a code; the person opens this page anywhere, signs in, enters the code
// and approves. On approve the page mints an API token (Clerk-authed, as the consent page does) and hands it to the
// MCP worker for the waiting CLI to collect; on cancel it refuses the code, so the CLI stops waiting. No help link:
// the CLI's own README documents it.
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SOLID_BRAND_DARK_CONTROL } from '@livediagram/ui';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { apiExchangeOauthToken } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/clerk-config';
import {
  completeDevice,
  denyDevice,
  fetchDeviceSession,
  userCodeOf,
} from '@/lib/mcp-device-session';
import { track } from '@/lib/telemetry';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { OauthShell } from '../oauth-shell';

type Step =
  | { kind: 'enter' }
  | { kind: 'checking' }
  | { kind: 'unknown' }
  | { kind: 'consent'; userCode: string; clientName: string; working: boolean; failed: boolean }
  | { kind: 'done' }
  | { kind: 'cancelled' };

const PRIMARY = `rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 ${SOLID_BRAND_DARK_CONTROL}`;
const SECONDARY =
  'rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
const HEADING = 'text-lg font-semibold text-slate-900 dark:text-slate-100';
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
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
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
  if (!clerkEnabled)
    return (
      <Message
        heading="Connecting apps isn’t available"
        body="This deployment doesn’t have accounts enabled, so there’s nothing to connect to."
      />
    );
  if (!authLoaded)
    return (
      <OauthShell>
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </OauthShell>
    );
  if (!isSignedIn || !clerkUserId) {
    const back =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
    return (
      <OauthShell>
        <h1 className={HEADING}>Sign in to connect the livediagram CLI</h1>
        <div className="mt-5 flex items-center gap-2">
          <a
            href={`/sign-in/?redirect_url=${encodeURIComponent(back)}`}
            className={`inline-flex ${PRIMARY}`}
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
            failed: false,
          }
        : { kind: 'unknown' },
    );
  };

  const approve = async (userCode: string, clientName: string) => {
    setStep({ kind: 'consent', userCode, clientName, working: true, failed: false });
    try {
      const { token, expiresAt } = await apiExchangeOauthToken(clerkUserId, clientName, readOnly);
      if (!(await completeDevice(userCode, token, expiresAt))) throw new Error('complete failed');
      // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): the CLI signed in, which mints a token.
      track('Token', 'Created', 'Cli');
      setStep({ kind: 'done' });
    } catch {
      setStep({ kind: 'consent', userCode, clientName, working: false, failed: true });
    }
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
            <button type="button" onClick={() => setStep({ kind: 'enter' })} className={PRIMARY}>
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
            wants to access your livediagram documents on your behalf. Approving creates an API
            token, which you can revoke any time from Settings, under Account › API Tokens.
          </p>
          <button
            type="button"
            onClick={() => setReadOnly(!readOnly)}
            aria-pressed={readOnly}
            className="mt-4 flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm dark:border-slate-700"
          >
            <span className="min-w-0 text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                Read-only access
              </span>
              : let it find and view your documents, but not create, edit, delete, or share them.
              Leave off for full read + write.
            </span>
            <span className="mt-0.5 shrink-0">
              <ToggleSwitch presentational checked={readOnly} label="Read-only access" />
            </span>
          </button>
          {failed ? (
            <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">
              Something went wrong. Please try again.
            </p>
          ) : null}
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void approve(userCode, clientName)}
              disabled={working}
              className={PRIMARY}
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
              <button type="submit" className={PRIMARY}>
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
