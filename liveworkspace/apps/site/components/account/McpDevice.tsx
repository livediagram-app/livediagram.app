'use client';

// Device sign-in for the apps' CLIs (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in"): a CLI on a
// machine without a browser shows a code; the person opens this page anywhere, signs in, types the code and approves.
// Approving mints an account token for the CLI and hands it to the one MCP for the waiting terminal to collect; Cancel
// refuses the code, so the terminal stops waiting.
//
// The code is always typed, never read from the page's address: anyone can start a grant with a CLI's public client
// id and send a link, so a code that arrived in a link would need only one click to hand them a six-month token. The
// approval step says when, and roughly where, the request started.
import { useMemo, useRef, useState } from 'react';
import { Button, usePageRestore } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { accountApi } from '@/lib/account-api';
import { signInHref } from '@/lib/accounts';
import { trackMcpTokenCreated } from '@/lib/explorer/telemetry';
import { connectDevice, handOverError, mcpOrigin } from '@/lib/mcp-connect';
import { deviceSessionClient, startedLine, userCodeOf } from '@/lib/mcp-device-session';
import { useSession } from '@/lib/session';
import {
  AccountCard,
  AccountHeading,
  Alert,
  FIELD,
  LABEL,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from './AccountPage';
import { OauthHelpLink, OauthWarning, ReadOnlyAccessToggle } from './oauth/oauth-chrome';
import { TokenLimitListLazy } from './oauth/TokenLimitListLazy';
import { ConnectPitch } from './Pitch';

type Consent = {
  kind: 'consent';
  userCode: string;
  clientName: string;
  // "Started 3 mins ago, from near Dublin, Ireland.", worked out when the code was checked.
  started: string | null;
};

type Step =
  | { kind: 'enter' }
  | { kind: 'checking' }
  | { kind: 'unknown' }
  | Consent
  | { kind: 'done' }
  | { kind: 'cancelled' };

export function McpDevice() {
  return (
    <>
      <DeviceCard />
      <ConnectPitch />
    </>
  );
}

function DeviceCard() {
  const signedIn = useSession();
  const device = useMemo(
    () => deviceSessionClient(typeof window === 'undefined' ? '' : mcpOrigin(window.location)),
    [],
  );
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'enter' });
  const [readOnly, setReadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // At the token cap, as on the consent page: the tokens are listed to revoke one, then there is room (`freed`).
  const [atLimit, setAtLimit] = useState(false);
  const [freed, setFreed] = useState(false);
  const connectRef = useRef<HTMLButtonElement>(null);
  usePageRestore(() => setBusy(false));

  // Cancel refuses the code when there is one, so the terminal stops waiting.
  const cancel = async () => {
    const userCode = step.kind === 'consent' ? step.userCode : userCodeOf(typed);
    if (userCode) await device.deny(userCode);
    setStep({ kind: 'cancelled' });
  };

  if (step.kind === 'cancelled')
    return (
      <AccountCard narrow>
        <AccountHeading title="Connection cancelled">
          Your terminal will stop waiting.
        </AccountHeading>
      </AccountCard>
    );
  if (step.kind === 'done')
    return (
      <AccountCard narrow>
        <AccountHeading title="You’re connected">
          Return to your terminal; it carries on by itself.
        </AccountHeading>
      </AccountCard>
    );
  if (signedIn.state === 'checking')
    return (
      <AccountCard narrow>
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Loading…
        </p>
      </AccountCard>
    );
  if (signedIn.state === 'out')
    return (
      <AccountCard narrow>
        <AccountHeading title="Sign in to connect a terminal">
          Sign in to connect a liveworkspace app’s CLI to your account.
        </AccountHeading>
        <a
          href={signInHref(window.location.pathname)}
          className={`flex items-center justify-center ${PRIMARY_BUTTON}`}
        >
          Sign in
        </a>
        <OauthHelpLink />
      </AccountCard>
    );

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
          }
        : { kind: 'unknown' },
    );
  };

  const approve = async (consent: Consent) => {
    setError('');
    setFreed(false);
    setBusy(true);
    const result = await connectDevice(device, consent.userCode, consent.clientName, readOnly);
    setBusy(false);
    if (result.ok) {
      // Anonymous telemetry: a CLI signed in, which mints a token.
      trackMcpTokenCreated('Cli');
      setStep({ kind: 'done' });
      return;
    }
    if (result.reason === 'token_limit') setAtLimit(true);
    setError(
      result.reason === 'token_limit'
        ? handOverError('token_limit')
        : 'Couldn’t connect. Run the sign-in again from your terminal.',
    );
  };

  if (step.kind === 'checking')
    return (
      <AccountCard narrow>
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Checking this code…
        </p>
      </AccountCard>
    );

  if (step.kind === 'unknown')
    return (
      <AccountCard narrow>
        <AccountHeading title="We couldn’t find that code">
          Check it and try again. Codes last 10 minutes.
        </AccountHeading>
        <button type="button" onClick={() => setStep({ kind: 'enter' })} className={PRIMARY_BUTTON}>
          Try again
        </button>
      </AccountCard>
    );

  if (step.kind === 'consent') {
    const { clientName, started } = step;
    return (
      <AccountCard narrow>
        <AccountHeading title={`Connect ${clientName}`}>
          <strong className="break-all text-slate-900 dark:text-slate-100">
            <bdi>{clientName}</bdi>
          </strong>{' '}
          wants to act as you in your liveworkspace apps. Approving creates an API Token you can
          revoke any time in Settings.
        </AccountHeading>
        <OauthWarning title="Only connect if you started this in your own terminal just now.">
          {started ? <p>{started}</p> : null}
          <p>If someone sent you a link or a code, choose Cancel.</p>
        </OauthWarning>
        <ReadOnlyAccessToggle
          noun="items"
          readOnly={readOnly}
          onChange={setReadOnly}
          line="view your items, but not change them."
        />
        {error && !freed ? (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        {freed ? (
          <Callout tone="success" role="status" className="mt-3">
            There’s room now. Choose Connect.
          </Callout>
        ) : null}
        {atLimit ? (
          <TokenLimitListLazy
            request={accountApi}
            onFreed={() => {
              setFreed(true);
              connectRef.current?.focus();
            }}
          />
        ) : null}
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
            onClick={() => void approve(step)}
            busy={busy}
            className={PRIMARY_BUTTON}
          >
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </AccountCard>
    );
  }

  return (
    <AccountCard narrow>
      <AccountHeading title="Connect a terminal">
        Type the code your terminal shows to connect a liveworkspace app’s CLI to your account.
      </AccountHeading>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <label htmlFor="device-code" className={LABEL}>
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
          className={`${FIELD} font-mono tracking-widest uppercase`}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Only enter a code shown by a terminal you are using.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="none" onClick={() => void cancel()} className={SECONDARY_BUTTON}>
            Cancel
          </Button>
          <button type="submit" className={PRIMARY_BUTTON}>
            Continue
          </button>
        </div>
      </form>
      <OauthHelpLink />
    </AccountCard>
  );
}
