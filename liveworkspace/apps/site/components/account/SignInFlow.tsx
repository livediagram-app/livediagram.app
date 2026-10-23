'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  afterSignIn,
  call,
  EMAIL_PATTERN,
  handoffBind,
  isRegistering,
  onAppAddress,
  nextUrl,
  returnPath,
  signedOAuthQuery,
  type SignInOptions,
} from '@/lib/accounts';
import { useLocationSearch } from '@/lib/location-search';
import { loadTurnstile, type Turnstile } from '@/lib/turnstile';
import {
  AccountCard,
  AccountHeading,
  Alert,
  FIELD,
  LABEL,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
} from './AccountPage';
import { APP_NAMES, Pitch } from './Pitch';

// Signing in and registering (liveworkspace/docs/site.md "Accounts"): an email code, or Google, and
// the person's first and last name. The page is static; an app's OAuth request rides in its query,
// signed by the accounts Worker, and goes back with each step so the sign-in finishes in the app.

type Flow = 'sign-in' | 'sign-up';
type Step = 'email' | 'code' | 'name' | 'done';
interface Names {
  givenName: string;
  familyName: string;
}

// Google: the page leaves for Google and comes back to itself, or straight to the app when the
// provider can finish the sign-in on the way. A mark in this tab's storage says which visit is the
// return trip.
const GOOGLE_MARK = 'liveworkspace:google';

function storage<T>(action: (s: Storage) => T): T | null {
  try {
    return action(sessionStorage);
  } catch {
    return null;
  }
}

// A text field's trimmed value.
function field(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === 'string' ? value.trim() : '';
}

const DIGITS = 6;
const EMPTY_CODE = Array<string>(DIGITS).fill('');

export function SignInFlow({ flow }: { flow: Flow }) {
  const signingUp = flow === 'sign-up';
  const [options, setOptions] = useState<SignInOptions | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [title, setTitle] = useState(signingUp ? 'Create your account' : 'Sign in');
  const [error, setErrorText] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  // The query the page was opened with: the signed OAuth request.
  const search = useLocationSearch();

  const names = useRef<Names | null>(null);
  const continueTo = useRef<string | null>(null);
  const verifying = useRef(false);
  const digitBoxes = useRef<(HTMLInputElement | null)[]>([]);
  const captchaBox = useRef<HTMLDivElement>(null);
  const captcha = useRef<{ turnstile: Turnstile; widget: string } | null>(null);
  const nameStepGiven = useRef<HTMLInputElement>(null);

  const setError = (message: string) => {
    setErrorText(message);
    if (message) setNotice('');
  };

  // Turnstile only draws itself when it wants a press; until then it takes no room.
  const siteKey = options?.turnstileSiteKey ?? '';
  useEffect(() => {
    const box = captchaBox.current;
    if (!siteKey || !box) return;
    let widget: { turnstile: Turnstile; widget: string } | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widget = {
          turnstile,
          widget: turnstile.render(box, {
            sitekey: siteKey,
            size: 'flexible',
            appearance: 'interaction-only',
          }),
        };
        captcha.current = widget;
      })
      .catch(() => setError('We could not load the security check. Refresh to try again.'));
    return () => {
      cancelled = true;
      if (widget) widget.turnstile.remove(widget.widget);
      captcha.current = null;
    };
  }, [siteKey]);

  const nameMax = options?.nameMaxLength ?? 80;

  function namesFrom(form: HTMLFormElement): Names | null {
    const read = (name: string) => field(form, name).slice(0, nameMax);
    const givenName = read('givenName');
    const familyName = read('familyName');
    if (!givenName) return (setError('Please enter your first name.'), null);
    if (!familyName) return (setError('Please enter your last name.'), null);
    return { givenName, familyName };
  }

  // Turnstile takes a moment to clear a visitor, and again after each reset, so a quick submit or
  // Resend waits for its token rather than being refused for not having one.
  async function captchaToken(): Promise<string> {
    if (!siteKey) return '';
    for (let waited = 0; waited < 15000; waited += 200) {
      const token = captcha.current?.turnstile.getResponse(captcha.current.widget);
      if (token) return token;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return '';
  }

  async function sendCode(to: string): Promise<boolean> {
    const token = await captchaToken();
    const result = await call(
      '/email-otp/send-verification-otp',
      { email: to, type: 'sign-in' },
      { 'x-captcha-response': token },
    );
    captcha.current?.turnstile.reset(captcha.current.widget);
    if (result.ok) return true;
    setError(
      result.status === 429
        ? 'Too many codes requested. Wait a minute and try again.'
        : 'We could not send a code. Check the address and try again.',
    );
    return false;
  }

  async function onEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    if (signingUp) {
      names.current = namesFrom(form);
      if (!names.current) return;
    }
    const address = field(form, 'email').toLowerCase();
    if (!EMAIL_PATTERN.test(address)) return setError('Please enter a valid email address.');
    setBusy('Sending code…');
    const sent = await sendCode(address);
    setBusy(null);
    if (!sent) return;
    setEmail(address);
    setDigits(EMPTY_CODE);
    setStep('code');
  }

  // The first box takes focus whenever the code step opens.
  useEffect(() => {
    if (step === 'code') digitBoxes.current[0]?.focus();
    if (step === 'name') nameStepGiven.current?.focus();
  }, [step]);

  async function verify(otp: string) {
    if (verifying.current) return;
    setError('');
    if (!/^[0-9]{6}$/.test(otp)) return setError('The code is 6 digits.');
    verifying.current = true;
    setBusy('Verifying…');
    // A new account takes the names typed on the registration page; an existing one keeps its own.
    const chosen = names.current;
    const result = await call('/sign-in/email-otp', {
      email,
      otp,
      oauth_query: signedOAuthQuery(window.location.search),
      ...(chosen ? { ...chosen, name: `${chosen.givenName} ${chosen.familyName}` } : {}),
    });
    verifying.current = false;
    setBusy(null);
    if (!result.ok) {
      setDigits(EMPTY_CODE);
      digitBoxes.current[0]?.focus();
      return setError(
        result.data.code === 'TOO_MANY_ATTEMPTS'
          ? 'Too many wrong codes. Request a new one.'
          : result.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : 'That code is wrong or has expired.',
      );
    }
    continueTo.current = typeof result.data.url === 'string' ? result.data.url : null;
    const session = await call('/get-session');
    const user = session.ok
      ? (session.data.user as { givenName?: unknown } | undefined)
      : undefined;
    if (user && !user.givenName) {
      // Registered with names, but the address already had a nameless account: give it these.
      if (chosen && (await saveNames(chosen))) return finish();
      setTitle("What's your name?");
      setStep('name');
      return;
    }
    await finish();
  }

  function fill(text: string, from: number) {
    const clean = text.replace(/\D/g, '').slice(0, DIGITS - from);
    const next = [...digits];
    for (let i = 0; i < clean.length; i++) next[from + i] = clean[i]!;
    setDigits(next);
    digitBoxes.current[Math.min(from + clean.length, DIGITS - 1)]?.focus();
    const code = next.join('');
    if (code.length === DIGITS) void verify(code);
  }

  async function saveNames(chosen: Names): Promise<boolean> {
    const result = await call('/update-user', {
      ...chosen,
      name: `${chosen.givenName} ${chosen.familyName}`,
    });
    return result.ok;
  }

  async function onName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const chosen = namesFrom(event.currentTarget);
    if (!chosen) return;
    setBusy('Saving…');
    const saved = await saveNames(chosen);
    setBusy(null);
    if (!saved) return setError('We could not save your name. Please try again.');
    await finish();
  }

  async function finish() {
    const query = window.location.search;
    if (isRegistering(query)) {
      const next = nextUrl(
        await call('/oauth2/continue', { created: true, oauth_query: signedOAuthQuery(query) }),
      );
      // Under an app's address, by way of liveworkspace.app, so the session is there too.
      if (next) return window.location.assign(await afterSignIn(next, query));
      return setError('That sign-in has expired. Go back to the app and try again.');
    }
    if (continueTo.current) {
      return window.location.assign(await afterSignIn(continueTo.current, query));
    }
    // Signed in from the site's header: back to the page it was on.
    const back = returnPath(query);
    if (back) return window.location.assign(back);
    setTitle("You're signed in");
    setStep('done');
  }

  async function resend() {
    setError('');
    setBusy('resend');
    const sent = await sendCode(email);
    setBusy(null);
    if (sent) setNotice('We sent you a new code.');
  }

  async function google(given: SignInOptions | null = options) {
    setError('');
    setBusy('google');
    // Under an app's address, until Google may come back to it: the same request on liveworkspace.app's own page,
    // which starts Google there (`#google`) and signs in there, as it always has.
    if (onAppAddress() && given && !given.googleOnApps) {
      return window.location.assign(
        `${given.accountsUrl}${window.location.pathname}${window.location.search}#google`,
      );
    }
    storage((s) => s.setItem(GOOGLE_MARK, '1'));
    const here = window.location.pathname + window.location.search;
    const next = nextUrl(
      await call('/sign-in/social', {
        provider: 'google',
        callbackURL: here,
        errorCallbackURL: here,
        oauth_query: signedOAuthQuery(window.location.search),
      }),
    );
    if (next) return window.location.assign(next);
    storage((s) => s.removeItem(GOOGLE_MARK));
    setBusy(null);
    setError('We could not reach Google. Try again, or use your email.');
  }

  // Once, on arrival: the deployment's options, and the end of a trip to Google.
  useEffect(() => {
    let cancelled = false;
    void call('/sign-in-options').then((result) => {
      if (cancelled) return;
      const data = result.data as Partial<SignInOptions>;
      const given: SignInOptions = {
        turnstileSiteKey: typeof data.turnstileSiteKey === 'string' ? data.turnstileSiteKey : '',
        google: data.google === true,
        nameMaxLength: typeof data.nameMaxLength === 'number' ? data.nameMaxLength : 80,
        accountsUrl: typeof data.accountsUrl === 'string' ? data.accountsUrl : '',
        googleOnApps: data.googleOnApps === true,
      };
      setOptions(given);
      // Sent here from an app's address to sign in with Google (`#google`): start it at once.
      if (given.google && !onAppAddress() && window.location.hash === '#google') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        void google(given);
      }
    });
    // Kept for the tab: the hand-off at the end needs it, whatever pages come between.
    handoffBind(window.location.search);
    // Back from Google: signed in, or with Google's refusal in the query.
    if (storage((st) => st.getItem(GOOGLE_MARK)) === '1') {
      storage((st) => st.removeItem(GOOGLE_MARK));
      void call('/get-session').then((session) => {
        if (cancelled) return;
        if (session.ok && session.data.user) void finish();
        else if (new URLSearchParams(window.location.search).has('error'))
          setError('Signing in with Google did not finish. Try again, or use your email.');
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const code = digits.join('');
  const working = busy !== null;

  return (
    <>
      <AccountCard>
        <AccountHeading title={title}>
          One account for {APP_NAMES} and the rest of liveworkspace.
        </AccountHeading>
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="notice">{notice}</Alert>}

        {step === 'email' && options?.google && (
          <div className="mb-4 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => void google()}
              disabled={working}
              className="relative flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-400 dark:hover:bg-slate-800"
            >
              <GoogleGlyph />
              <span>{busy === 'google' ? 'Redirecting…' : 'Continue with Google'}</span>
            </button>
            <div
              aria-hidden
              className="flex items-center gap-2 text-xs tracking-wider text-slate-600 uppercase before:flex-1 before:border-t before:border-slate-200 after:flex-1 after:border-t after:border-slate-200 dark:text-slate-400 dark:before:border-slate-700 dark:after:border-slate-700"
            >
              or
            </div>
          </div>
        )}

        {step === 'email' && (
          <form
            onSubmit={(event) => void onEmail(event)}
            noValidate
            className="flex flex-col gap-4"
          >
            {signingUp && <NameFields prefix="new" max={nameMax} autoFocus />}
            <div>
              <label htmlFor="email" className={LABEL}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                autoFocus={!signingUp}
                className={FIELD}
              />
            </div>
            <button type="submit" disabled={working} className={PRIMARY_BUTTON}>
              {busy === 'Sending code…'
                ? busy
                : signingUp
                  ? 'Create account'
                  : 'Continue with email'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
            noValidate
            className="flex flex-col gap-4"
          >
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              We sent a verification code to{' '}
              <strong className="text-slate-900 dark:text-slate-100">{email}</strong>. Enter it
              below.
            </p>
            <div role="group" aria-label="Verification code" className="flex justify-center gap-2">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(box) => {
                    digitBoxes.current[i] = box;
                  }}
                  value={digit}
                  inputMode="numeric"
                  maxLength={1}
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${i + 1}`}
                  disabled={working}
                  onChange={(event) => {
                    const typed = event.target.value.replace(/\D/g, '');
                    if (typed) return fill(typed, i);
                    const next = [...digits];
                    next[i] = '';
                    setDigits(next);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Backspace' && !digit && i > 0)
                      digitBoxes.current[i - 1]?.focus();
                  }}
                  onPaste={(event) => {
                    event.preventDefault();
                    fill(event.clipboardData.getData('text'), 0);
                  }}
                  className={`${FIELD} h-13 w-11 p-0 text-center text-xl font-semibold`}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={working || code.length !== DIGITS}
              className={PRIMARY_BUTTON}
            >
              {busy === 'Verifying…' ? busy : 'Verify'}
            </button>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => void resend()}
                disabled={working}
                className={QUIET_BUTTON}
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep('email');
                }}
                disabled={working}
                className={QUIET_BUTTON}
              >
                Back
              </button>
            </div>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={(event) => void onName(event)} noValidate className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              What should we call you? Your name shows on your work and to your teammates.
            </p>
            <NameFields prefix="name" max={nameMax} givenRef={nameStepGiven} />
            <button type="submit" disabled={working} className={PRIMARY_BUTTON}>
              {busy === 'Saving…' ? busy : 'Continue'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            You&apos;re signed in. You can close this tab, or go back to the app you came from.
          </p>
        )}

        <div ref={captchaBox} className="mt-4 empty:hidden" />

        {step === 'email' && (
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {signingUp ? 'Already have an account? ' : 'New to liveworkspace? '}
            {/* The other page keeps the signed request, so switching mid-sign-in still finishes
                back in the app. */}
            <a
              href={`${signingUp ? '/sign-in' : '/sign-up'}${search}`}
              className="relative touch-target-y font-medium text-slate-900 hover:underline dark:text-slate-200"
            >
              {signingUp ? 'Sign in' : 'Create an account'}
            </a>
          </p>
        )}
      </AccountCard>
      <Pitch google={options?.google ?? false} />
    </>
  );
}

function NameFields({
  prefix,
  max,
  autoFocus = false,
  givenRef,
}: {
  prefix: string;
  max: number;
  autoFocus?: boolean;
  givenRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${prefix}-given`} className={LABEL}>
          First name
        </label>
        <input
          ref={givenRef}
          id={`${prefix}-given`}
          name="givenName"
          type="text"
          autoComplete="given-name"
          placeholder="Jane"
          maxLength={max}
          required
          autoFocus={autoFocus}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-family`} className={LABEL}>
          Last name
        </label>
        <input
          id={`${prefix}-family`}
          name="familyName"
          type="text"
          autoComplete="family-name"
          placeholder="Doe"
          maxLength={max}
          required
          className={FIELD}
        />
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
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
