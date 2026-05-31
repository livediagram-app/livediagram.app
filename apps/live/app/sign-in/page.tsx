'use client';

// Custom sign-in page. Ported from Manager Toolkit's
// apps/dashboard/app/sign-in/page.tsx — same email-code + Google OAuth
// flow, livediagram branding, livediagram routes.
//
// Per spec/04, this page is never required to use the editor — the
// editor stays open to guests forever. Sign-in only unlocks per-account
// persistence (diagrams travel across devices) and team workspaces.
// Authenticated users get redirected straight to the editor; guests
// can sign in here when they want to bind their session to an account.

import { useAuth } from '@clerk/nextjs';
import { useSignIn } from '@clerk/nextjs/legacy';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Brand } from '@livediagram/ui';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

const POST_AUTH_DEFAULT = '/live/';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signIn: clerkSignIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showCodeStep, setShowCodeStep] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Honour ?redirect_url when it's a same-origin path under /live and
  // doesn't loop back to auth. Otherwise fall through to /live/ (which
  // resolves to /live/new via the welcome flow per spec/14).
  const resolvePostSignInDestination = useCallback((): string => {
    const redirect = searchParams.get('redirect_url');
    const safe =
      redirect?.startsWith('/live') &&
      !redirect.toLowerCase().startsWith('/live/sign-in') &&
      !redirect.toLowerCase().startsWith('/live/get-started');
    return safe && redirect ? redirect : POST_AUTH_DEFAULT;
  }, [searchParams]);

  // Already signed in? Bounce straight to the editor. Without this the
  // page renders the form briefly before Clerk fires the redirect on
  // its own, which looks like a flash.
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.replace(resolvePostSignInDestination());
    }
  }, [authLoaded, isSignedIn, router, resolvePostSignInDestination]);

  useEffect(() => {
    if (showCodeStep) codeInputRefs.current[0]?.focus();
  }, [showCodeStep]);

  const handleSignInWithGoogle = async () => {
    if (!signInLoaded || !clerkSignIn) return;
    setError('');
    setGoogleLoading(true);
    try {
      await clerkSignIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/live/sso-callback',
        redirectUrlComplete: '/live/',
      });
    } catch (err: unknown) {
      setError(messageOf(err, 'Google sign-in failed'));
      setGoogleLoading(false);
    }
  };

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!signInLoaded || !clerkSignIn) {
      setLoading(false);
      return;
    }
    try {
      if (!email.trim()) {
        setError('Email is required');
        setLoading(false);
        return;
      }
      const signInRes = await clerkSignIn.create({ identifier: email.trim() });
      const factor = signInRes.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
      if (!factor || !('emailAddressId' in factor)) {
        setError('Email code sign-in is not available. Please contact support.');
        setLoading(false);
        return;
      }
      await clerkSignIn.prepareFirstFactor({
        strategy: 'email_code',
        emailAddressId: factor.emailAddressId,
      });
      setCodeDigits(['', '', '', '', '', '']);
      setShowCodeStep(true);
      setError('');
    } catch (err: unknown) {
      const msg = messageOf(err, 'Something went wrong');
      // Unknown email → bounce to sign-up with the email pre-filled.
      if (msg.toLowerCase().includes("couldn't find your account")) {
        const trimmed = email.trim();
        router.replace(
          trimmed ? `/live/get-started?email=${encodeURIComponent(trimmed)}` : '/live/get-started',
        );
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent, codeOverride?: string) => {
    e.preventDefault();
    const code = (codeOverride ?? codeDigits.join('')).trim();
    if (code.length !== 6 || !clerkSignIn) return;
    setError('');
    setLoading(true);
    try {
      const res = await clerkSignIn.attemptFirstFactor({ strategy: 'email_code', code });
      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveSignIn({ session: res.createdSessionId });
        router.push(resolvePostSignInDestination());
        return;
      }
      setError('Invalid or expired code. Try again or request a new code.');
    } catch (err: unknown) {
      setError(messageOf(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);
    setCodeDigits(['', '', '', '', '', '']);
    try {
      if (clerkSignIn) {
        const factor = clerkSignIn.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
        if (factor && 'emailAddressId' in factor) {
          await clerkSignIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: factor.emailAddressId,
          });
          setError('A new code has been sent. Check your email.');
          codeInputRefs.current[0]?.focus();
        }
      }
    } catch (err: unknown) {
      setError(messageOf(err, 'Failed to resend code'));
    } finally {
      setLoading(false);
    }
  };

  const clearAndGoBack = () => {
    setShowCodeStep(false);
    setCodeDigits(['', '', '', '', '', '']);
    setError('');
  };

  if (authLoaded && isSignedIn) {
    return <RedirectingCard />;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/10">
          <div className="mb-8 text-center">
            <div className="mb-3 flex justify-center">
              <Brand href="/" />
            </div>
            <p className="text-sm text-slate-600">Sign in to your account</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {showCodeStep ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-sm text-slate-600">
                We sent a verification code to <strong className="text-slate-900">{email}</strong>.
                Enter it below.
              </p>
              <CodeInputRow
                codeDigits={codeDigits}
                setCodeDigits={setCodeDigits}
                inputRefs={codeInputRefs}
                onComplete={(full) => {
                  if (!loading && clerkSignIn) {
                    void handleVerifyCode({ preventDefault: () => {} } as React.FormEvent, full);
                  }
                }}
              />
              <button
                type="submit"
                disabled={loading || codeDigits.join('').length !== 6}
                className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-slate-600 hover:text-slate-900 disabled:opacity-60"
                >
                  Resend code
                </button>
                <button
                  type="button"
                  onClick={clearAndGoBack}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Back
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitEmail} className="space-y-4">
              <button
                type="button"
                onClick={handleSignInWithGoogle}
                disabled={!signInLoaded || googleLoading}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {googleLoading ? (
                  <span className="text-slate-500">Redirecting…</span>
                ) : (
                  <>
                    <GoogleGlyph />
                    Continue with Google
                  </>
                )}
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide">
                  <span className="bg-white px-2 text-slate-400">or</span>
                </div>
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Sending code…' : 'Continue with email'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-600">
            New to livediagram?{' '}
            <Link href="/live/get-started/" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- small helpers + sub-components ----

function messageOf(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'errors' in err) {
    const list = (err as { errors: Array<{ message: string }> }).errors;
    if (Array.isArray(list)) return list.map((e) => e.message).join(', ');
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function RedirectingCard() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 text-center shadow-lg shadow-slate-900/10">
        <p className="text-sm text-slate-600">Redirecting…</p>
      </div>
    </div>
  );
}

function CodeInputRow({
  codeDigits,
  setCodeDigits,
  inputRefs,
  onComplete,
}: {
  codeDigits: string[];
  setCodeDigits: (digits: string[]) => void;
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onComplete: (fullCode: string) => void;
}) {
  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={codeDigits[i]}
          className="h-12 w-10 rounded-md border border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            const next = [...codeDigits];
            next[i] = v;
            setCodeDigits(next);
            if (v && i < 5) inputRefs.current[i + 1]?.focus();
            if (next.join('').length === 6) onComplete(next.join(''));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !codeDigits[i] && i > 0) {
              inputRefs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            const next = ['', '', '', '', '', ''];
            for (let j = 0; j < pasted.length; j++) next[j] = pasted[j]!;
            setCodeDigits(next);
            inputRefs.current[Math.min(pasted.length, 5)]?.focus();
            if (pasted.length === 6) onComplete(next.join(''));
          }}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<RedirectingCard />}>
      <SignInContent />
    </Suspense>
  );
}
