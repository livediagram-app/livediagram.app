'use client';

// MCP OAuth consent screen (spec/62 §3). The MCP authorize endpoint redirects
// the signed-in user here with a `session` (and a display-only `client` name +
// `to` redirect host). On approve we mint an lvd_ token via the api
// (Clerk-authed) and hand it to the MCP's /oauth/complete bound to a one-time
// PKCE code, then bounce the browser to the client's redirect. Signed-in only;
// absent end-to-end without Clerk.
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Brand } from '@livediagram/ui';
import { AnimatedLinesBackdrop } from '@/components/canvas/AnimatedLinesBackdrop';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { apiExchangeOauthToken } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/clerk-config';
import { MCP_ORIGIN } from '@/lib/mcp-config';
import { track } from '@/lib/telemetry';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      {/* Same animated lines backdrop as the new-diagram page; decorative,
          reduced-motion aware, hidden below sm. */}
      <AnimatedLinesBackdrop />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mb-5">
          <Brand href="/" size="md" />
        </div>
        {children}
      </div>
    </main>
  );
}

// Help link to the connect-an-AI-tool article. Opens in a new tab so it never
// abandons the in-progress OAuth session on this screen.
function HelpLink() {
  return (
    <a
      href="/help/account-and-data/connect-ai-mcp/"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-brand-600 dark:text-slate-500 dark:hover:text-brand-400"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" />
        <path d="M6.2 6.3a1.8 1.8 0 1 1 2.3 1.8c-.5.2-.7.5-.7 1.1" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="0.5" fill="currentColor" stroke="none" />
      </svg>
      Learn about connecting AI tools
    </a>
  );
}

function Consent() {
  const params = useSearchParams();
  const session = params.get('session');
  const client = params.get('client') || 'An application';
  const to = params.get('to');
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error' | 'cancelled'>('idle');
  // Read-only opt-in (spec/62 §4.11): grant the tool view-only access — it can
  // find and read diagrams but not create / edit / delete / share.
  const [readOnly, setReadOnly] = useState(false);

  // Checked first so Cancel works from any state (incl. the sign-in screen,
  // which otherwise returns before the later checks).
  if (status === 'cancelled') {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Connection cancelled
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          You can close this window.
        </p>
      </Shell>
    );
  }

  if (!clerkEnabled) {
    return (
      <Shell>
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Connecting apps isn’t available
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This deployment doesn’t have accounts enabled, so there’s nothing to connect to.
        </p>
      </Shell>
    );
  }
  if (!authLoaded) {
    return (
      <Shell>
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </Shell>
    );
  }
  if (!isSignedIn || !clerkUserId) {
    // Return here after sign-in. The sign-in page reads `redirect_url` (NOT
    // `redirect`) and validates it as a safe internal path before bouncing
    // back — /oauth/consent?... qualifies, so the user lands back on consent.
    const back =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Sign in to connect {client}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          You need to be signed in to connect an app to your diagrams.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <a
            href={`/sign-in/?redirect_url=${encodeURIComponent(back)}`}
            className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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
          <HelpLink />
        </div>
      </Shell>
    );
  }
  if (!session) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          This link is incomplete
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          The connection request is missing its session. Start the connection again from your app.
        </p>
      </Shell>
    );
  }

  const approve = async () => {
    setStatus('connecting');
    try {
      const { token, expiresAt } = await apiExchangeOauthToken(clerkUserId, client, readOnly);
      const res = await fetch(`${MCP_ORIGIN}/oauth/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, token, expiresAt }),
      });
      if (!res.ok) throw new Error('complete failed');
      // Anonymous telemetry (spec/22): an AI tool was connected via MCP, which
      // mints a token. `type` is the fixed source, never the client name.
      track('Token', 'Created', 'MCP');
      const { redirectTo } = (await res.json()) as { redirectTo: string };
      window.location.href = redirectTo;
    } catch {
      setStatus('error');
    }
  };

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Connect {client}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-200">{client}</span> wants to
        access your livediagram diagrams on your behalf. Approving creates an API token, which you
        can revoke any time from the Explorer’s API tokens page.
      </p>
      {/* Whole-row toggle with the shared presentational switch (the same
          pattern as ProfilePane / SettingsDialog rows) — this was the last
          native checkbox in the live app. */}
      <button
        type="button"
        onClick={() => setReadOnly(!readOnly)}
        aria-pressed={readOnly}
        className="mt-4 flex w-full cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm dark:border-slate-700"
      >
        <span className="min-w-0 text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-800 dark:text-slate-100">Read-only access</span> —
          let it find and view your diagrams, but not create, edit, delete, or share them. Leave off
          for full read + write.
        </span>
        <span className="mt-0.5 shrink-0">
          <ToggleSwitch presentational checked={readOnly} label="Read-only access" />
        </span>
      </button>
      {to ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          Access will be sent to{' '}
          <span className="font-medium text-slate-700 dark:text-slate-200">{to}</span>. Only
          continue if you recognise this.
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">
          Something went wrong. Please try again.
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void approve()}
          disabled={status === 'connecting'}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50"
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
        <HelpLink />
      </div>
    </Shell>
  );
}

export default function OauthConsentPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </Shell>
      }
    >
      <Consent />
    </Suspense>
  );
}
