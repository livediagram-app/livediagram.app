'use client';

// The pairing page (liveworkspace/docs/specs/011-workbench/workbench.md; each app's docs/specs/013-workspace/workbench-embeds.md
// "Pairing"): a workbench asked, with one of the person's API tokens, to open their work in one app, and they answer
// here, signed in to liveworkspace.app, in their own browser. One read once the session is known, one answer; focus
// follows the heading at each state.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { APP_ITEMS, siteOfApp, type AppName } from '@liveworkspace/sites';
import { Button } from '@liveworkspace/ui';
import { accountApi } from '@/lib/account-api';
import { signInHref } from '@/lib/accounts';
import { useSession } from '@/lib/session';
import { JoinShell } from '../teams/JoinPage';
import { BUTTON } from '../settings/account-ui';

// A pairing code: 16 random bytes as base64url.
const CODE = /^[A-Za-z0-9_-]{22}$/;

type PairingRequest = {
  origin: string;
  name: string | null;
  tokenName: string | null;
  // The app's word for one item (`project`, `document`, `design`), or `workspace`.
  scope: string;
  expiresAt: number;
  status: 'pending' | 'approved' | 'declined' | 'expired';
  app: AppName;
};

type Answer = 'approve' | 'decline';

type Step =
  | { kind: 'pending'; request: PairingRequest; working: Answer | null; failed: boolean }
  | { kind: 'missing' }
  | { kind: 'allowed'; request: PairingRequest }
  | { kind: 'declined'; request: PairingRequest }
  | { kind: 'expired'; request: PairingRequest | null }
  | { kind: 'answered'; request: PairingRequest | null };

const noChange = () => () => {};

export function codeFrom(search: string): string | null {
  const code = new URLSearchParams(search).get('code') ?? '';
  return CODE.test(code) ? code : null;
}

function stepOf(request: PairingRequest): Step {
  if (request.status === 'pending')
    return { kind: 'pending', request, working: null, failed: false };
  if (request.status === 'expired') return { kind: 'expired', request };
  return { kind: 'answered', request };
}

// What the app's work is called on its own site: "plans", "canvases".
const worksOf = (app: AppName) => APP_ITEMS[app].nouns.toLowerCase();
const workOf = (app: AppName) => APP_ITEMS[app].noun.toLowerCase();
const pairCommand = (app: AppName | undefined) => `${app ?? '<app>'} workbench pair`;

const MONO = 'font-mono text-[0.8125rem] break-all text-slate-800 dark:text-slate-200';
const STRONG = 'font-medium text-slate-900 dark:text-white';
const BODY = 'mx-auto mt-3 max-w-sm text-slate-600 dark:text-slate-400';

// Focus moves to the heading at each state: each state keys its own heading, so a change mounts a fresh one.
const focusOnMount = (el: HTMLHeadingElement | null) => el?.focus();

function Heading({ state, children }: { state: string; children: ReactNode }) {
  return (
    <h1
      key={state}
      ref={focusOnMount}
      tabIndex={-1}
      className="text-2xl font-semibold tracking-tight text-slate-900 focus:outline-none dark:text-white"
    >
      {children}
    </h1>
  );
}

function Message({ state, title, body }: { state: string; title: string; body: ReactNode }) {
  return (
    <div className="text-center">
      <Heading state={state}>{title}</Heading>
      <p className={BODY}>{body}</p>
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy className="flex flex-col items-center">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div className="h-7 w-56 animate-pulse rounded-lg bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
      <div className="mt-4 h-4 w-72 animate-pulse rounded bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70" />
    </div>
  );
}

const Missing = () => (
  <Message
    state="missing"
    title="We couldn’t find this request"
    body="It may belong to another account. Check you’re signed in as the person who runs the workbench."
  />
);

export function PairWorkbench() {
  const code = useSyncExternalStore(
    noChange,
    () => codeFrom(window.location.search),
    () => undefined,
  );
  const session = useSession();
  const [step, setStep] = useState<Step | null>(null);
  const signedIn = session.state === 'in';

  // The page's one read, once the session is known to be in.
  useEffect(() => {
    if (!signedIn || !code) return;
    let live = true;
    void accountApi<{ request: PairingRequest }>(
      `/workbench/pairing-requests/${encodeURIComponent(code)}`,
    ).then((result) => {
      if (live) setStep(result.ok ? stepOf(result.data.request) : { kind: 'missing' });
    });
    return () => {
      live = false;
    };
  }, [signedIn, code]);

  const answer = async (request: PairingRequest, choice: Answer) => {
    if (!code) return;
    setStep({ kind: 'pending', request, working: choice, failed: false });
    const result = await accountApi(
      `/workbench/pairing-requests/${encodeURIComponent(code)}/${choice}`,
      'POST',
      {},
    );
    if (result.ok) {
      setStep(choice === 'approve' ? { kind: 'allowed', request } : { kind: 'declined', request });
    } else if (result.error === 'pairing_answered') {
      setStep({ kind: 'answered', request });
    } else if (result.error === 'pairing_expired') {
      setStep({ kind: 'expired', request });
    } else if (result.status === 404) {
      setStep({ kind: 'missing' });
    } else {
      setStep({ kind: 'pending', request, working: null, failed: true });
    }
  };

  return <JoinShell>{body()}</JoinShell>;

  function body(): ReactNode {
    if (code === undefined || session.state === 'checking') return <Loading />;
    if (session.state === 'out') {
      const here = `/workbench/pair${code ? `?code=${code}` : ''}`;
      return (
        <div className="text-center">
          <Heading state="signed-out">Sign in to allow this workbench</Heading>
          <p className={BODY}>
            A workbench asked to open your work. Sign in with the account its token belongs to.
          </p>
          <div className="mt-8 flex justify-center">
            <a
              href={signInHref(here)}
              className={`${BUTTON.primary} relative touch-target-y px-6 py-2.5`}
            >
              Sign in
            </a>
          </div>
        </div>
      );
    }
    if (!code) return <Missing />;
    if (!step) return <Loading />;
    switch (step.kind) {
      case 'missing':
        return <Missing />;
      case 'allowed':
        return (
          <Message
            state="allowed"
            title="Workbench allowed"
            body={`Return to ${step.request.name ?? 'your workbench'}; it carries on by itself.`}
          />
        );
      case 'declined':
        return (
          <Message
            state="declined"
            title="Workbench not allowed"
            body="Nothing was paired. Your terminal will stop waiting."
          />
        );
      case 'expired':
        return (
          <Message
            state="expired"
            title="This request has expired"
            body={
              <>
                Run <code className={MONO}>{pairCommand(step.request?.app)}</code> again to ask
                anew.
              </>
            }
          />
        );
      case 'answered':
        return (
          <Message
            state="answered"
            title="This request was already answered"
            body={
              <>
                Run <code className={MONO}>{pairCommand(step.request?.app)}</code> again if you need
                to ask anew.
              </>
            }
          />
        );
      case 'pending':
        return <PendingRequest step={step} onAnswer={answer} />;
    }
  }
}

export function PendingRequest({
  step,
  onAnswer,
}: {
  step: Extract<Step, { kind: 'pending' }>;
  onAnswer: (request: PairingRequest, choice: Answer) => Promise<void>;
}) {
  const { request, working, failed } = step;
  const app = request.app;
  const site = siteOfApp(app).name;
  const workspace = request.scope === 'workspace';
  const token = request.tokenName ? (
    <>
      the token <strong className={STRONG}>{request.tokenName}</strong>
    </>
  ) : (
    'an unnamed token'
  );
  const state = working ? 'working' : failed ? 'failed' : 'pending';
  return (
    <div className="text-center">
      <p className="text-sm font-semibold tracking-[.18em] text-slate-500 uppercase dark:text-slate-400">
        {site}
      </p>
      <div className="mt-2">
        <Heading state={state}>Allow this workbench?</Heading>
      </div>
      {/* The two questions (workbench-embeds.md "Pairing", step 3): the whole workspace is asked for in its own
          words, never as one more item. */}
      <p className={BODY}>
        Allow {request.name ? <strong className={STRONG}>{request.name}</strong> : 'a workbench'} at{' '}
        <code className={MONO}>{request.origin}</code> to open{' '}
        {workspace ? (
          <>
            <strong className={STRONG}>your whole workspace in {site}</strong>, and to create, move,
            share and trash {worksOf(app)} and folders in it,
          </>
        ) : (
          <>your {worksOf(app)}</>
        )}{' '}
        with {token}?
      </p>
      <p className={BODY}>
        {workspace
          ? `It works in your Explorer and your ${worksOf(app)}, as you, inside that tool.`
          : `It opens one ${workOf(app)} at a time, as you, inside that tool.`}{' '}
        You can unpair it any time in Settings, under API tokens.
      </p>
      {failed ? (
        <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">
          Something went wrong. Please try again.
        </p>
      ) : null}
      <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row-reverse sm:justify-center">
        {/* Busy while either answer is sent (busy-buttons.md): the pressed one keeps the keyboard. */}
        <Button
          variant="none"
          busy={working !== null}
          onClick={() => void onAnswer(request, 'approve')}
          className={`${BUTTON.primary} relative touch-target-y px-6 py-2.5`}
        >
          {working === 'approve' ? 'Allowing…' : 'Allow'}
        </Button>
        <Button
          variant="none"
          busy={working !== null}
          onClick={() => void onAnswer(request, 'decline')}
          className={`${BUTTON.secondary} relative touch-target-y py-2.5`}
        >
          Don’t allow
        </Button>
      </div>
    </div>
  );
}
