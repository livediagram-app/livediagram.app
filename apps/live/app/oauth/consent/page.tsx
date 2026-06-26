'use client';

// MCP OAuth consent screen (spec/62 §3). The MCP authorize endpoint redirects
// the signed-in user here with a `session` (and a display-only `client` name).
// On approve we mint an lvd_ token via the api (Clerk-authed) and hand it to the
// MCP's /oauth/complete bound to a one-time PKCE code, then bounce the browser
// to the client's redirect. Signed-in only; absent end-to-end without Clerk.
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiExchangeOauthToken } from '@/lib/api-client';
import { clerkEnabled } from '@/lib/clerk-config';
import { MCP_ORIGIN } from '@/lib/mcp-config';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            ld
          </span>
          <span className="text-sm font-semibold text-slate-700">livediagram</span>
        </div>
        {children}
      </div>
    </main>
  );
}

function Consent() {
  const params = useSearchParams();
  const session = params.get('session');
  const client = params.get('client') || 'An application';
  const to = params.get('to');
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error' | 'cancelled'>('idle');

  if (!clerkEnabled) {
    return (
      <Shell>
        <h1 className="text-base font-semibold text-slate-900">Connecting apps isn’t available</h1>
        <p className="mt-2 text-sm text-slate-500">
          This deployment doesn’t have accounts enabled, so there’s nothing to connect to.
        </p>
      </Shell>
    );
  }
  if (!authLoaded) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">Loading…</p>
      </Shell>
    );
  }
  if (!isSignedIn || !clerkUserId) {
    const back =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
    return (
      <Shell>
        <h1 className="text-base font-semibold text-slate-900">Sign in to connect {client}</h1>
        <p className="mt-2 text-sm text-slate-500">
          You need to be signed in to connect an app to your diagrams.
        </p>
        <a
          href={`/sign-in/?redirect=${encodeURIComponent(back)}`}
          className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
        >
          Sign in
        </a>
      </Shell>
    );
  }
  if (!session) {
    return (
      <Shell>
        <h1 className="text-base font-semibold text-slate-900">This link is incomplete</h1>
        <p className="mt-2 text-sm text-slate-500">
          The connection request is missing its session. Start the connection again from your app.
        </p>
      </Shell>
    );
  }

  const approve = async () => {
    setStatus('connecting');
    try {
      const { token, expiresAt } = await apiExchangeOauthToken(clerkUserId, client);
      const res = await fetch(`${MCP_ORIGIN}/oauth/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, token, expiresAt }),
      });
      if (!res.ok) throw new Error('complete failed');
      const { redirectTo } = (await res.json()) as { redirectTo: string };
      window.location.href = redirectTo;
    } catch {
      setStatus('error');
    }
  };

  if (status === 'cancelled') {
    return (
      <Shell>
        <h1 className="text-base font-semibold text-slate-900">Connection cancelled</h1>
        <p className="mt-2 text-sm text-slate-500">You can close this window.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-base font-semibold text-slate-900">Connect {client}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        <span className="font-medium text-slate-700">{client}</span> wants to access your
        livediagram diagrams (full read + write) on your behalf. Approving creates an API token,
        which you can revoke any time from the Explorer’s API tokens page.
      </p>
      {to ? (
        <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Access will be sent to <span className="font-medium text-slate-700">{to}</span>. Only
          continue if you recognise this.
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="mt-3 text-xs text-rose-600">Something went wrong. Please try again.</p>
      ) : null}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void approve()}
          disabled={status === 'connecting'}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
        >
          {status === 'connecting' ? 'Connecting…' : 'Connect'}
        </button>
        <button
          type="button"
          onClick={() => setStatus('cancelled')}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </Shell>
  );
}

export default function OauthConsentPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <p className="text-sm text-slate-500">Loading…</p>
        </Shell>
      }
    >
      <Consent />
    </Suspense>
  );
}
