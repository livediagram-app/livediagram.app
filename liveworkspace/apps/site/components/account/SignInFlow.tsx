'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  CODE_DIGITS,
  CodeDigits,
  type CodeDigitsHandle,
  EMPTY_CODE,
  usePageRestore,
} from '@liveworkspace/ui';
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
  timeZoneHeader,
  type SignInOptions,
} from '@/lib/accounts';
import { workspaceOrigin } from '@/lib/explorer/page-app';
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
import { Pitch } from './Pitch';
import {
  type Step,
  type Names,
  GOOGLE_MARK,
  storage,
  codeDayMessage,
  field,
} from './sign-in-flow-model';
import { NameFields, GoogleGlyph } from './SignInFlowParts';
export { codeDayMessage } from './sign-in-flow-model';

// Signing in and registering (liveworkspace/docs/specs/010-site/site.md "Accounts"): an email code, or Google, and
// the person's first and last name. The page is static; an app's OAuth request rides in its query,
// signed by the accounts Worker, and goes back with each step so the sign-in finishes in the app.

type Flow = 'sign-in' | 'sign-up';

export function SignInFlow({ flow }: { flow: Flow }) {
  const signingUp = flow === 'sign-up';
  const [options, setOptions] = useState<SignInOptions | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [title, setTitle] = useState(signingUp ? 'Create your account' : 'Sign in');
  const [error, setErrorText] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<readonly string[]>(EMPTY_CODE);
  // The query the page was opened with: the signed OAuth request.
  const search = useLocationSearch();

  const names = useRef<Names | null>(null);
  const continueTo = useRef<string | null>(null);
  const verifying = useRef(false);
  const digitBoxes = useRef<CodeDigitsHandle>(null);
  const captchaBox = useRef<HTMLDivElement>(null);
  const captcha = useRef<{ turnstile: Turnstile; widget: string } | null>(null);
  // Whether the widget's token went with a send. It is reset only when the next send needs one, so the code
  // step doesn't run a fresh check (and show the widget again) right after the email step's.
  const captchaSpent = useRef(false);
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
    if (captchaSpent.current && captcha.current) {
      captcha.current.turnstile.reset(captcha.current.widget);
      captchaSpent.current = false;
    }
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
    captchaSpent.current = true;
    if (result.ok) return true;
    setError(
      codeDayMessage(result.data.code, options?.google === true) ??
        (result.status === 429
          ? 'Too many codes requested. Wait a minute and try again.'
          : 'We could not send a code. Check the address and try again.'),
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
    if (step === 'code') digitBoxes.current?.focus();
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
    // Busy on through the session check, the continue and the navigation (busy-buttons.md): only a failure or a
    // step that stays on this page lets go.
    if (!result.ok) {
      setBusy(null);
      setDigits(EMPTY_CODE);
      // After the render that enables the boxes again: a disabled box takes no focus.
      requestAnimationFrame(() => digitBoxes.current?.focus());
      return setError(
        result.data.code === 'TOO_MANY_ATTEMPTS'
          ? 'Too many wrong codes. Request a new one.'
          : result.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : 'That code is wrong or has expired.',
      );
    }
    continueTo.current = typeof result.data.url === 'string' ? result.data.url : null;
    const session = await call('/get-session', undefined, timeZoneHeader());
    const user = session.ok
      ? (session.data.user as { givenName?: unknown } | undefined)
      : undefined;
    if (user && !user.givenName) {
      // Registered with names, but the address already had a nameless account: give it these.
      if (chosen && (await saveNames(chosen))) return finish();
      setBusy(null);
      setTitle("What's your name?");
      setStep('name');
      return;
    }
    await finish();
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
    if (!(await saveNames(chosen))) {
      setBusy(null);
      return setError('We could not save your name. Please try again.');
    }
    await finish();
  }

  // The last step: leaves the page (busy stays on until the browser has gone), or lets go of busy where it stays.
  async function finish() {
    const query = window.location.search;
    if (isRegistering(query)) {
      const next = nextUrl(
        await call('/oauth2/continue', { created: true, oauth_query: signedOAuthQuery(query) }),
      );
      // Under an app's address, by way of liveworkspace.app, so the session is there too.
      if (next) return window.location.assign(await afterSignIn(next, query));
      setBusy(null);
      return setError('That sign-in has expired. Go back to the app and try again.');
    }
    if (continueTo.current) {
      return window.location.assign(await afterSignIn(continueTo.current, query));
    }
    // Signed in from the site's header: back to the page it was on.
    const back = returnPath(query);
    if (back) return window.location.assign(back);
    setBusy(null);
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
      // liveworkspace.app's address for this one when the options name none, so the page always leaves (a bare
      // `#google` on this page would only change the hash).
      const accounts = given.accountsUrl || workspaceOrigin();
      return window.location.assign(
        `${accounts}${window.location.pathname}${window.location.search}#google`,
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

  // Back into this page from the browser's cache: kept as it was when it left, busy. Pressable again.
  usePageRestore(() => {
    verifying.current = false;
    setBusy(null);
  });

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
      void call('/get-session', undefined, timeZoneHeader()).then((session) => {
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
          One free account that works for every app in liveworkspace.
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
            <CodeDigits
              ref={digitBoxes}
              digits={digits}
              onDigits={setDigits}
              onComplete={(full) => void verify(full)}
              disabled={working}
              boxClassName={`${FIELD} h-13 w-11 p-0 text-center text-xl font-semibold`}
            />
            <button
              type="submit"
              disabled={working || code.length !== CODE_DIGITS}
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
