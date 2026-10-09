'use client';

// The self-hosted deployment's session, without Clerk
// (docs/specs/016-platform/self-hosted-runtime.md, "Identity").
//
// The same shape and the same trick as E2EAuthBridge: publish into
// DeferredAuthContext exactly what ClerkBridge publishes, so nothing above this
// file knows which provider signed the session in. This one is real — it talks to
// the identity provider the app process serves, on this origin, so the paths are
// relative and the session cookie rides along.

import { useEffect } from 'react';
import { DEFERRED_AUTH_DEFAULT, type DeferredAuthState } from './deferred-auth';

/** Dispatched by the sign-in page once a session exists, so an open bridge re-reads. */
export const SELF_HOST_AUTH_EVENT = 'livediagram:self-host-auth';

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  createdAt?: string | null;
};

/**
 * The JWT's own expiry, so a token is cached until it is nearly stale rather than
 * minted per request — and never past it, whatever the provider's lifetime is.
 */
function expiryOf(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const method = init?.method ?? 'GET';
    const writes = method !== 'GET' && method !== 'HEAD';
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        accept: 'application/json',
        // Better Auth answers 415 to a write without a content type, and 400 to one
        // whose body is not JSON — even on an endpoint that takes no arguments at all.
        // Sign-out went through both: it was a silent no-op, because a failed sign-out
        // leaves a working session cookie behind and the page simply stayed signed in.
        ...(writes ? { 'content-type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
      ...(writes && init?.body === undefined ? { body: '{}' } : {}),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function SelfHostAuthBridge({ onState }: { onState: (state: DeferredAuthState) => void }) {
  useEffect(() => {
    let live = true;
    let cached: { token: string; expiresAt: number } | null = null;

    const settle = async (): Promise<void> => {
      const session = await getJson<{ user?: SessionUser } | null>('/api/auth/get-session');
      if (!live) return;
      const user = session?.user;
      if (!user) {
        onState({ ...DEFERRED_AUTH_DEFAULT, authLoaded: true });
        return;
      }
      const name = user.name?.trim() ?? '';
      const [first, ...rest] = name.split(/\s+/).filter(Boolean);
      onState({
        authLoaded: true,
        isSignedIn: true,
        userId: user.id,
        user: {
          id: user.id,
          firstName: first ?? null,
          lastName: rest.length > 0 ? rest.join(' ') : null,
          fullName: name || null,
          username: null,
          email: user.email,
          createdAt: user.createdAt ? new Date(user.createdAt) : null,
          pictureUrl: user.image ?? null,
        },
        getToken: async () => {
          if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
          const minted = await getJson<{ token?: string }>('/api/auth/token');
          const token = minted?.token ?? null;
          if (token) cached = { token, expiresAt: expiryOf(token) || Date.now() + 60_000 };
          return token;
        },
        signOut: async () => {
          cached = null;
          await getJson('/api/auth/sign-out', { method: 'POST' });
          window.location.assign('/');
        },
        // Self-deletion is Clerk's step-up flow; the provider serves it, but
        // wiring a destructive action to a button needs its own pass
        // (docs/specs/014-identity/profile-picture.md and the settings surface).
        deleteAccount: null,
      });
    };

    void settle();
    const onChanged = () => void settle();
    window.addEventListener(SELF_HOST_AUTH_EVENT, onChanged);
    return () => {
      live = false;
      window.removeEventListener(SELF_HOST_AUTH_EVENT, onChanged);
    };
  }, [onState]);

  return null;
}
