'use client';

// Sign-in and sign-up for a self-hosted deployment
// (docs/specs/016-platform/self-hosted-runtime.md, "Identity").
//
// One form for both pages, because the provider has one flow: a code is emailed,
// and the account is created on first use if the address is new. That is the point
// of choosing a one-time code — there is no password to set, no separate sign-up
// form to keep in step, and nothing to reset.
//
// It reuses the same chrome as the Clerk pages (components/chrome/auth-shared), so
// the two look like one product rather than two.

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  AuthCard,
  AuthEmailField,
  EmailCodeStep,
  GoogleAuthButton,
  OrDivider,
  POST_AUTH_DEFAULT,
  POST_AUTH_SIGNIN_DEFAULT,
  resolvePostAuthDestination,
  useAuthHrefs,
} from '@/components/chrome/auth-shared';
import { Button } from '@livediagram/ui';
import { SELF_HOST_AUTH_EVENT } from '@/components/providers/SelfHostAuthBridge';
import { useAuthMethods } from '@/lib/self-host-auth';

const EMPTY_CODE = ['', '', '', '', '', ''];

/** Posts JSON and returns the provider's message on failure, or null on success. */
async function post(path: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const parsed = (await res.json().catch(() => null)) as { message?: string } | null;
    return parsed?.message ?? 'Something went wrong. Try again.';
  } catch {
    return 'Could not reach the server. Check your connection and try again.';
  }
}

export function SelfHostSignInForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const searchParams = useSearchParams();
  const { signInHref, signUpHref } = useAuthHrefs();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeStep, setCodeStep] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(EMPTY_CODE);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [socialLoading, setSocialLoading] = useState('');
  const methods = useAuthMethods();

  const destination = resolvePostAuthDestination(
    searchParams,
    mode === 'sign-in' ? POST_AUTH_SIGNIN_DEFAULT : POST_AUTH_DEFAULT,
  );

  // A provider sign-in leaves the page entirely: Better Auth answers with the URL to
  // send the browser to, and the callback returns here with a session.
  const startSocial = async (provider: string) => {
    setSocialLoading(provider);
    setError('');
    try {
      const res = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, callbackURL: destination }),
      });
      const body = (await res.json().catch(() => null)) as { url?: string; message?: string } | null;
      if (!res.ok || !body?.url) {
        setSocialLoading('');
        setError(body?.message ?? 'Could not start that sign-in.');
        return;
      }
      window.location.assign(body.url);
    } catch {
      setSocialLoading('');
      setError('Could not reach the server.');
    }
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    // \`sign-in\` covers sign-up too: the provider creates the account when the
    // address is unknown, which is what "no password" buys.
    const failure = await post('/api/auth/email-otp/send-verification-otp', {
      email: email.trim(),
      type: 'sign-in',
    });
    setLoading(false);
    if (failure) {
      setError(failure);
      return;
    }
    setCodeDigits(EMPTY_CODE);
    setCodeStep(true);
  };

  const verify = async (e: React.FormEvent, code?: string) => {
    e.preventDefault();
    const otp = (code ?? codeDigits.join('')).trim();
    if (otp.length !== 6) return;
    setLoading(true);
    setError('');
    const failure = await post('/api/auth/sign-in/email-otp', { email: email.trim(), otp });
    if (failure) {
      setLoading(false);
      setError(failure);
      // A wrong code leaves the field ready for another try rather than clearing it.
      return;
    }
    // A full load, not a client navigation: the session is a cookie the bridge
    // reads on mount, and the guest document the person may have been editing
    // migrates on the next boot (docs/specs/014-identity/auth-and-guest-access.md).
    window.dispatchEvent(new Event(SELF_HOST_AUTH_EVENT));
    window.location.assign(destination);
  };

  return (
    <AuthCard
      subtitle={
        mode === 'sign-in'
          ? 'Sign in to keep your documents across devices.'
          : 'Create an account to keep your documents across devices.'
      }
      error={error}
      footer={
        mode === 'sign-in' ? (
          <>
            No account yet?{' '}
            <Link href={signUpHref} className="font-medium text-slate-900 dark:text-slate-100">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href={signInHref} className="font-medium text-slate-900 dark:text-slate-100">
              Sign in
            </Link>
          </>
        )
      }
    >
      {codeStep ? (
        <EmailCodeStep
          email={email.trim()}
          codeDigits={codeDigits}
          setCodeDigits={setCodeDigits}
          inputRefs={codeInputRefs}
          loading={loading}
          ready
          onSubmit={verify}
          onResend={() => void sendCode({ preventDefault: () => {} } as React.FormEvent)}
          onBack={() => {
            setCodeStep(false);
            setError('');
          }}
        />
      ) : (
        <form onSubmit={sendCode} className="space-y-4">
          {methods?.includes('feishu') ? (
            <>
              <GoogleAuthButton
                label="Continue with Feishu"
                loading={socialLoading === 'feishu'}
                disabled={socialLoading !== ''}
                onClick={() => void startSocial('feishu')}
              />
              <OrDivider />
            </>
          ) : null}
          <AuthEmailField value={email} onChange={setEmail} />
          <Button type="submit" size="md" disabled={loading} className="w-full shadow-sm">
            {loading ? 'Sending…' : 'Email me a code'}
          </Button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            We&apos;ll email you a six-digit code. No password to remember.
          </p>
        </form>
      )}
    </AuthCard>
  );
}