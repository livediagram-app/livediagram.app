'use client';

// Sign-up page. Simplified port of MT's apps/dashboard/app/get-started
// page: livediagram has no teams and no paid tier, so the MT phase
// model collapses to two:
//
//   Phase 1 — register: first name + last name + email (or Google OAuth)
//   Phase 2 — verify: 6-digit email code → redirect to editor
//
// Post-verification we hand off to /live/ (which resolves to /live/new
// via the welcome flow, spec/14). The guest → authed migration of any
// pre-existing diagrams lives in Stage 4 — out of scope for this page
// for now.

// See sign-in/page.tsx for why useSignUp comes from @clerk/react/legacy
// while useAuth comes from the modern entry.
import { useAuth } from '@clerk/react';
import { useSignUp } from '@clerk/react/legacy';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  AuthCard,
  AuthDisabledNotice,
  CodeInputRow,
  GoogleGlyph,
  messageOf,
  RedirectingCard,
  resolveOAuthCompleteUrl,
  resolvePostAuthDestination,
} from '@/components/chrome/auth-shared';
import { clerkEnabled, googleOAuthEnabled } from '@/lib/clerk-config';
import { track } from '@/lib/telemetry';

type Phase = 1 | 2;

function GetStartedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signUp: clerkSignUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();

  const [phase, setPhase] = useState<Phase>(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(() => searchParams.get('email')?.trim() ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Already signed in — straight to the editor. Without this guard the
  // form renders for a frame before Clerk's own redirect fires.
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.replace(resolvePostAuthDestination(searchParams));
    }
  }, [authLoaded, isSignedIn, router, searchParams]);

  useEffect(() => {
    if (phase === 2) codeInputRefs.current[0]?.focus();
  }, [phase]);

  const handleSignUpWithGoogle = async () => {
    if (!signUpLoaded || !clerkSignUp) return;
    setError('');
    setGoogleLoading(true);
    try {
      await clerkSignUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        // Honour ?redirect_url so an OAuth sign-up from a protected
        // page lands back where it came from, matching the email-code
        // path. See spec/04 "Routes" + auth-shared.tsx.
        redirectUrlComplete: resolveOAuthCompleteUrl(searchParams),
      });
    } catch (err: unknown) {
      setError(messageOf(err, 'Google sign-up failed'));
      setGoogleLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!signUpLoaded || !clerkSignUp) {
      setLoading(false);
      return;
    }
    try {
      if (!firstName.trim()) {
        setError('First name is required');
        setLoading(false);
        return;
      }
      if (!lastName.trim()) {
        setError('Last name is required');
        setLoading(false);
        return;
      }
      if (!email.trim()) {
        setError('Email is required');
        setLoading(false);
        return;
      }
      const res = await clerkSignUp.create({
        emailAddress: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      // Clerk can complete the sign-up immediately when email
      // verification is configured off — straight to the editor.
      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveSignUp({ session: res.createdSessionId });
        track('Session', 'SignedUp');
        router.replace(resolvePostAuthDestination(searchParams));
        return;
      }
      // Otherwise prepare the 6-digit code and advance to phase 2.
      if (res.unverifiedFields?.includes('email_address')) {
        await clerkSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setCodeDigits(['', '', '', '', '', '']);
        setPhase(2);
        setError('');
      } else {
        setError('Sign-up could not be completed. Please try again.');
      }
    } catch (err: unknown) {
      const msg = messageOf(err, 'Something went wrong');
      // Email already in use → send them to sign-in instead.
      if (
        msg.toLowerCase().includes('email address is taken') ||
        msg.toLowerCase().includes('that email address is taken')
      ) {
        router.replace('/sign-in/');
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
    if (code.length !== 6 || !clerkSignUp) return;
    setError('');
    setLoading(true);
    try {
      const res = await clerkSignUp.attemptEmailAddressVerification({ code });
      if (res.status === 'complete' && res.createdSessionId) {
        await setActiveSignUp({ session: res.createdSessionId });
        track('Session', 'SignedUp');
        router.replace(resolvePostAuthDestination(searchParams));
        return;
      }
      // Clerk verified the code but isn't ready to mint a session.
      // The usual cause is the Clerk instance has additional required
      // fields (password, username, phone) that this UI doesn't
      // collect. Surface what's outstanding instead of the misleading
      // "invalid or expired code" — that wording sends the user
      // chasing a problem that isn't theirs.
      if (res.status === 'missing_requirements') {
        const missing = [...(res.missingFields ?? []), ...(res.unverifiedFields ?? [])].filter(
          (f) => f !== 'email_address',
        );
        if (missing.length > 0) {
          setError(
            `Your Clerk instance also requires: ${missing.join(', ')}. Disable those requirements in the Clerk dashboard or add them here.`,
          );
        } else {
          setError(`Sign-up could not be completed (status: ${res.status}).`);
        }
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
    if (!clerkSignUp) return;
    setError('');
    setLoading(true);
    setCodeDigits(['', '', '', '', '', '']);
    try {
      await clerkSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setError('A new code has been sent. Check your email.');
      codeInputRefs.current[0]?.focus();
    } catch (err: unknown) {
      setError(messageOf(err, 'Failed to resend code'));
    } finally {
      setLoading(false);
    }
  };

  if (authLoaded && isSignedIn) {
    return <RedirectingCard />;
  }

  return (
    <AuthCard
      subtitle={
        phase === 1
          ? 'Create a free account to keep your diagrams and work across multiple devices.'
          : 'Check your email'
      }
      error={error}
      footer={
        <>
          Already have an account?{' '}
          <Link href="/sign-in/" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {phase === 1 ? (
        <form onSubmit={handleRegister} className="space-y-4">
          {googleOAuthEnabled ? (
            <>
              <button
                type="button"
                onClick={handleSignUpWithGoogle}
                disabled={!signUpLoaded || googleLoading}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
            </>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-slate-700">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Jane"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-slate-700">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                placeholder="Doe"
                autoComplete="family-name"
              />
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
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      ) : (
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
              if (!loading && clerkSignUp) {
                void handleVerifyCode({ preventDefault: () => {} } as React.FormEvent, full);
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || codeDigits.join('').length !== 6}
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading}
              className="text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Resend code
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase(1);
                setError('');
                setCodeDigits(['', '', '', '', '', '']);
              }}
              className="text-slate-600 hover:text-slate-900"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}

export default function GetStartedPage() {
  // Same gate as sign-in — see that file for the rationale.
  if (!clerkEnabled) return <AuthDisabledNotice />;
  return (
    <Suspense fallback={<RedirectingCard />}>
      <GetStartedContent />
    </Suspense>
  );
}
