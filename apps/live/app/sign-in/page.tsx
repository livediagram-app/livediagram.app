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
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  AuthCard,
  CodeInputRow,
  GoogleGlyph,
  messageOf,
  RedirectingCard,
} from '@/components/auth-shared';

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
    <AuthCard
      subtitle="Sign in to your account"
      error={error}
      footer={
        <>
          New to livediagram?{' '}
          <Link href="/live/get-started/" className="font-medium text-brand-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
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
    </AuthCard>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<RedirectingCard />}>
      <SignInContent />
    </Suspense>
  );
}
