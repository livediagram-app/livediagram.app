'use client';

// The pairing page (docs/specs/013-workspace/workbench-embeds.md "Pairing"; blueprint "The pairing page"): a
// workbench asked to open the person's documents with one of their tokens, and they answer here, signed in, in
// their own browser. One read after auth settles, one answer; focus follows the heading at each state.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  WORKBENCH_HANDLE_PATTERN,
  type WorkbenchPairingRequestView,
} from '@livediagram/api-schema';
import {
  apiAnswerPairingRequest,
  apiReadPairingRequest,
  type PairingAnswerOutcome,
} from '@/lib/api-client';
import { sessionsEnabled } from '@/lib/clerk-config';
import { track } from '@/lib/telemetry';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { OAUTH_PRIMARY, OauthShell } from '../../oauth/oauth-shell';

type Answer = 'approve' | 'decline';

// What the read and the answer settle to. `pending` covers the table's Pending, Working and Failed rows.
type Step =
  | {
      kind: 'pending';
      request: WorkbenchPairingRequestView;
      working: Answer | null;
      failed: boolean;
    }
  | { kind: 'missing' }
  | { kind: 'allowed'; name: string | null }
  | { kind: 'declined' }
  | { kind: 'expired' }
  | { kind: 'answered' };

const SECONDARY =
  'rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
const HEADING = 'text-lg font-semibold text-slate-900 focus:outline-none dark:text-slate-100';
const BODY = 'mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400';
const STRONG = 'font-medium text-slate-700 dark:text-slate-200';
const MONO = 'font-mono text-[0.8125rem] break-all text-slate-700 dark:text-slate-200';
const PAIR_COMMAND = 'livediagram workbench pair';

function stepFromView(request: WorkbenchPairingRequestView): Step {
  if (request.status === 'pending')
    return { kind: 'pending', request, working: null, failed: false };
  if (request.status === 'expired') return { kind: 'expired' };
  return { kind: 'answered' };
}

const ANSWERED: Record<PairingAnswerOutcome, (request: WorkbenchPairingRequestView) => Step> = {
  approved: (request) => ({ kind: 'allowed', name: request.name }),
  declined: () => ({ kind: 'declined' }),
  answered: () => ({ kind: 'answered' }),
  expired: () => ({ kind: 'expired' }),
  missing: () => ({ kind: 'missing' }),
};

type PendingStep = Extract<Step, { kind: 'pending' }>;

// The table's Pending, Working and Failed rows, each its own state, so focus moves at each.
function pendingState(step: PendingStep): 'pending' | 'working' | 'failed' {
  if (step.working) return 'working';
  return step.failed ? 'failed' : 'pending';
}

// Focus moves to the heading on each state change: every state keys its own heading, so each change mounts a
// fresh one, and this stable ref focuses it once on mount (a re-render alone never steals focus).
const focusOnMount = (el: HTMLHeadingElement | null) => el?.focus();

function Heading({ state, children }: { state: string; children: React.ReactNode }) {
  return (
    <h1 key={state} ref={focusOnMount} tabIndex={-1} className={HEADING}>
      {children}
    </h1>
  );
}

function Message({ state, title, body }: { state: string; title: string; body: React.ReactNode }) {
  return (
    <OauthShell>
      <Heading state={state}>{title}</Heading>
      <p className={BODY}>{body}</p>
    </OauthShell>
  );
}

function Loading() {
  return (
    <OauthShell>
      <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </p>
    </OauthShell>
  );
}

function Missing() {
  return (
    <Message
      state="missing"
      title="We couldn’t find this request"
      body="It may belong to another account. Check you’re signed in as the person who runs the workbench."
    />
  );
}

const command = <code className={MONO}>{PAIR_COMMAND}</code>;

export function PairWorkbench() {
  const params = useSearchParams();
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
  const raw = params.get('code') ?? '';
  const code = WORKBENCH_HANDLE_PATTERN.test(raw) ? raw : null;
  const ownerId = authLoaded && isSignedIn && clerkUserId ? clerkUserId : null;
  const [step, setStep] = useState<Step | null>(null);

  // The page's one read, once auth has settled on a signed-in person.
  useEffect(() => {
    if (!sessionsEnabled || !ownerId || !code) return;
    let live = true;
    apiReadPairingRequest(ownerId, code)
      .then((request) => {
        if (live) setStep(request ? stepFromView(request) : { kind: 'missing' });
      })
      .catch(() => {
        console.warn('[workbench] pairing-read-failed');
        if (live) setStep({ kind: 'missing' });
      });
    return () => {
      live = false;
    };
  }, [ownerId, code]);

  if (!sessionsEnabled)
    return (
      <Message
        state="off"
        title="Workbenches aren’t available"
        body="This deployment doesn’t have accounts enabled, so there’s nothing to pair."
      />
    );
  if (!authLoaded) return <Loading />;
  if (!ownerId) {
    // Client only: useSearchParams bails this page out of the static prerender.
    const back = window.location.pathname + window.location.search;
    return (
      <OauthShell>
        <Heading state="signed-out">Sign in to approve this workbench</Heading>
        <div className="mt-5">
          <a
            href={`/sign-in/?redirect_url=${encodeURIComponent(back)}`}
            className={`inline-flex ${OAUTH_PRIMARY}`}
          >
            Sign in
          </a>
        </div>
      </OauthShell>
    );
  }
  if (!code) return <Missing />;
  if (!step) return <Loading />;

  const answer = async (request: WorkbenchPairingRequestView, choice: Answer) => {
    setStep({ kind: 'pending', request, working: choice, failed: false });
    try {
      const outcome = await apiAnswerPairingRequest(ownerId, code, choice);
      // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): a token's owner paired a workbench.
      if (outcome === 'approved') track('Token', 'Linked', 'Workbench');
      setStep(ANSWERED[outcome](request));
    } catch {
      setStep({ kind: 'pending', request, working: null, failed: true });
    }
  };

  switch (step.kind) {
    case 'missing':
      return <Missing />;
    case 'allowed':
      return (
        <Message
          state="allowed"
          title="Workbench allowed"
          body={`Return to ${step.name ?? 'your workbench'}; it carries on by itself.`}
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
          body={<>Run {command} again to ask anew.</>}
        />
      );
    case 'answered':
      return (
        <Message
          state="answered"
          title="This request was already answered"
          body={<>Run {command} again if you need to ask anew.</>}
        />
      );
    case 'pending':
      return <PendingRequest step={step} onAnswer={answer} />;
  }
}

function PendingRequest({
  step,
  onAnswer,
}: {
  step: PendingStep;
  onAnswer: (request: WorkbenchPairingRequestView, choice: Answer) => Promise<void>;
}) {
  const { request, working, failed } = step;
  const token = request.tokenName ? (
    <>
      the token <strong className={STRONG}>{request.tokenName}</strong>
    </>
  ) : (
    'an unnamed token'
  );
  return (
    <OauthShell>
      <Heading state={pendingState(step)}>Allow this workbench?</Heading>
      <p className={BODY}>
        Allow {request.name ? <strong className={STRONG}>{request.name}</strong> : 'a workbench'} at{' '}
        <code className={MONO}>{request.origin}</code> to open your documents with {token}?
      </p>
      <p className={BODY}>
        It opens one document at a time, as you, inside that tool. You can unpair it any time in
        Settings, under API Tokens.
      </p>
      {failed ? (
        <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">
          Something went wrong. Please try again.
        </p>
      ) : null}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onAnswer(request, 'approve')}
          disabled={working !== null}
          className={OAUTH_PRIMARY}
        >
          {working === 'approve' ? 'Allowing…' : 'Allow'}
        </button>
        <button
          type="button"
          onClick={() => void onAnswer(request, 'decline')}
          disabled={working !== null}
          className={SECONDARY}
        >
          Don’t allow
        </button>
      </div>
    </OauthShell>
  );
}
