'use client';

// Device sign-in (docs/specs/015-api/blueprints/cli.md "The device grant", "Presentation and UX", CLI36, CLI37): the
// CLI on a machine without a browser shows a code; the person opens this page anywhere, signs in, types the code and
// approves. On approve the page mints an API token (signed-in, as the consent page does) and hands it to the MCP
// worker for the waiting CLI to collect; on cancel it refuses the code, so the CLI stops waiting. No help link: the
// CLI's own README covers it.
//
// The code is always typed, never read from the page's address: anyone can start a grant with the public CLI client
// id and send a link, so a code that arrived in a link would need only one click to hand them a six-month token. The
// approval step says when, and roughly where, the request started, under "Only connect if you started this in your
// own terminal just now."
import { Suspense, use, useState } from 'react';
import { browser } from 'react-dom';
import { Button, formatRelativeTime } from '@liveworkspace/ui';
import { apiExchangeOauthToken } from '../../lib/api/oauth';
import { apiRevokeTokenAsItself } from '../../lib/api/tokens';
import {
  deviceSessionClient,
  userCodeOf,
  type DeviceSession,
  type DeviceSessionClient,
  type DeviceStartedIn,
} from '../../lib/mcp-device-session';
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
  OauthWarning,
  ReadOnlyAccessToggle,
  type OauthPagesConfig,
} from './oauth-chrome';

type Consent = {
  kind: 'consent';
  userCode: string;
  clientName: string;
  // "Started 3 mins ago, from near Dublin, Ireland.", worked out when the code was checked.
  started: string | null;
  working: boolean;
  // Why the last Connect failed, or null before one has.
  failed: HandoverFailure | null;
};

type Step =
  | { kind: 'enter' }
  | { kind: 'checking' }
  | { kind: 'unknown' }
  | Consent
  | { kind: 'done' }
  | { kind: 'cancelled' };

// A country code as its English name ("IE" as "Ireland"), or the code when the browser has no name for it.
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function placeOf(place: DeviceStartedIn | null): string | null {
  if (!place) return null;
  const parts = [place.city, place.country ? countryName(place.country) : undefined].filter(
    Boolean,
  );
  return parts.join(', ');
}

/** The line under the approval warning: when the terminal started, and roughly where; null when the server gave
 *  neither. */
export function startedLine(session: DeviceSession, now: number): string | null {
  const when =
    session.startedAt === null ? null : formatRelativeTime(Math.max(0, now - session.startedAt));
  const where = placeOf(session.startedIn);
  if (when && where) return `Started ${when}, from near ${where}.`;
  if (when) return `Started ${when}.`;
  if (where) return `Started from near ${where}.`;
  return null;
}

function Device({ config, device }: { config: OauthPagesConfig; device: DeviceSessionClient }) {
  const { Shell, titleClass, product, noun } = config;
  const { gate, accountUserId } = config.useSignIn();
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'enter' });
  const [readOnly, setReadOnly] = useState(false);

  // Cancel refuses the code when there is one, so the terminal stops waiting.
  const cancel = async () => {
    const userCode = step.kind === 'consent' ? step.userCode : userCodeOf(typed);
    if (userCode) await device.deny(userCode);
    setStep({ kind: 'cancelled' });
  };

  const message = (heading: string, body: string) => (
    <Shell>
      <h1 className={titleClass}>{heading}</h1>
      <p className={OAUTH_BODY}>{body}</p>
    </Shell>
  );

  if (step.kind === 'cancelled')
    return message('Connection cancelled', 'Your terminal will stop waiting.');
  if (gate === 'waiting')
    return (
      <Shell>
        <p className={OAUTH_QUIET}>Loading…</p>
      </Shell>
    );
  if (gate === 'sign-in' || !accountUserId) {
    // The browser's own address: this branch renders in the browser only (`use(browser())`, under the page's Suspense).
    use(browser());
    const back = window.location.pathname;
    return (
      <Shell>
        <h1 className={titleClass}>Sign in to connect the {product} CLI</h1>
        <div className="mt-5 flex items-center gap-2">
          <a
            href={`/sign-in/?redirect_url=${encodeURIComponent(back)}`}
            className={`inline-flex ${OAUTH_PRIMARY}`}
          >
            Sign in
          </a>
          <button type="button" onClick={() => void cancel()} className={OAUTH_SECONDARY}>
            Cancel
          </button>
        </div>
      </Shell>
    );
  }

  const check = async () => {
    const userCode = userCodeOf(typed);
    setStep({ kind: 'checking' });
    const session = userCode ? await device.fetchSession(userCode) : null;
    setStep(
      userCode && session
        ? {
            kind: 'consent',
            userCode,
            clientName: session.clientName,
            started: startedLine(session, Date.now()),
            working: false,
            failed: null,
          }
        : { kind: 'unknown' },
    );
  };

  const approve = async (consent: Consent) => {
    const { userCode, clientName } = consent;
    setStep({ ...consent, working: true, failed: null });
    // Checks the code is still waiting before minting, and revokes a token the MCP did not take, so a failed
    // Connect never leaves a six-month token behind (lib/oauth-handover.ts).
    const result = await mintAndHandOver({
      sessionLive: async () => (await device.fetchSession(userCode)) !== null,
      mint: () => apiExchangeOauthToken(accountUserId, clientName, readOnly),
      complete: async (token, expiresAt) =>
        (await device.complete(userCode, token, expiresAt)) ? true : null,
      revoke: (token) => apiRevokeTokenAsItself(token),
    });
    if (!result.ok) {
      setStep({ ...consent, working: false, failed: result.reason });
      return;
    }
    // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): the CLI signed in, which mints a token.
    config.onTokenCreated('Cli');
    setStep({ kind: 'done' });
  };

  switch (step.kind) {
    case 'done':
      return message('You’re connected', 'Return to your terminal; it carries on by itself.');
    case 'checking':
      return (
        <Shell>
          <p className={OAUTH_QUIET}>Checking this code…</p>
        </Shell>
      );
    case 'unknown':
      return (
        <Shell>
          <h1 className={titleClass}>We couldn’t find that code yet</h1>
          <p className={OAUTH_BODY}>Check it and try again. Codes last 10 minutes.</p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setStep({ kind: 'enter' })}
              className={OAUTH_PRIMARY}
            >
              Try again
            </button>
          </div>
        </Shell>
      );
    case 'consent': {
      const { clientName, started, working, failed } = step;
      return (
        <Shell>
          <h1 className={titleClass}>Connect {clientName}</h1>
          <p className={OAUTH_BODY}>
            <span className="font-medium text-slate-700 dark:text-slate-200">{clientName}</span>{' '}
            wants to act as you in your liveworkspace apps, {product} among them. Approving creates
            an API token for your liveworkspace account, which you can revoke any time on
            liveworkspace.app.
          </p>
          <OauthWarning title="Only connect if you started this in your own terminal just now.">
            {started ? <p>{started}</p> : null}
            <p>If someone sent you a link or a code, choose Cancel.</p>
          </OauthWarning>
          <ReadOnlyAccessToggle noun={noun} readOnly={readOnly} onChange={setReadOnly} />
          {failed ? (
            <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">
              {handoverFailureCopy(failed, 'Run the sign-in again from your terminal.')}
            </p>
          ) : null}
          <div className="mt-5 flex items-center gap-2">
            {/* Keeps the keyboard while it connects (busy-buttons.md). */}
            <Button
              variant="none"
              onClick={() => void approve(step)}
              busy={working}
              className={OAUTH_PRIMARY}
            >
              {working ? 'Connecting…' : 'Connect'}
            </Button>
            <button type="button" onClick={() => void cancel()} className={OAUTH_SECONDARY}>
              Cancel
            </button>
          </div>
        </Shell>
      );
    }
    default:
      return (
        <Shell>
          <h1 className={titleClass}>Connect a terminal</h1>
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
        </Shell>
      );
  }
}

/** An editor's /oauth/device page, bound to its facts once (its app/oauth/device/page.tsx). */
export function createOauthDevicePage(config: OauthPagesConfig) {
  const { Shell } = config;
  const device = deviceSessionClient(config.mcpOrigin);
  return function OauthDevicePage() {
    return (
      <Suspense
        fallback={
          <Shell>
            <p className={OAUTH_QUIET}>Loading…</p>
          </Shell>
        }
      >
        <Device config={config} device={device} />
      </Suspense>
    );
  };
}
