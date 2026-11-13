'use client';

// Describe a Plan (docs/specs/026-plan/describe-a-plan.md): the person's words, up to 500 characters, three examples
// that fill the box, the AI cost line, then Draft Plan (or Ctrl / ⌘ Enter). While it drafts the box is read-only and the
// button busy; Cancel stops waiting (the ask still counts). A draft turns the dialog to Check Your Plan (the preview),
// where Make Plan, the only press that makes anything, hands the edited draft up. A refusal is said under the box in
// the api's fixed words, the text kept to change; the model's own words are never shown. A guest sees a sign-in nudge
// in the box's place.

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PlanDraftResponse } from '@liveplanner/api-schema';
import {
  PLAN_DRAFT_PER_DAY,
  PLAN_DRAFT_PROMPT_MAX,
  planDraftProblems,
  type ItemTypeDef,
  type PlanDraft,
  type PlanDraftPlan,
} from '@liveplanner/items';
import {
  Button,
  DialogCloseButton,
  DialogFooter,
  DialogHeader,
  SparkleIcon,
  TextArea,
} from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { AiNote } from '@/components/automations/step-panels/AiStepPanel';
import { PlanDraftRefusal } from './plan-draft-client';
import { PlanDraftPreview } from './PlanDraftPreview';
import { problemsByPath } from './draft-edits';

export const DESCRIBE_PLAN_EXAMPLES: readonly { label: string; text: string }[] = [
  {
    label: 'Customer Onboarding',
    text: 'Onboarding new customers through Signed, Kickoff, Setup, Training and Live, with a Customer card holding Plan, Account Manager, Go-Live Date and Seats',
  },
  {
    label: 'Grant Applications',
    text: 'Grant applications from Researching and Drafting to Submitted, Awarded or Declined, with a Grant card holding Funder, Amount, Deadline and Link',
  },
  {
    label: 'Home Renovation',
    text: 'A home renovation from To Do and Quoted to Booked, In Progress and Done, with a Job card holding Room, Budget, Tradesperson and Start Date',
  },
];

export const DESCRIBE_PLAN_PLACEHOLDER =
  'A hiring pipeline with Applied, Screen, Interview and Offer, and a Candidate card with Role, Salary Band and Interview Date';
export const DESCRIBE_PLAN_FAILED = 'That didn’t work. Check your connection and try again.';
export const DESCRIBE_PLAN_SIGN_IN =
  'Sign in to describe a plan in your own words. Your plan stays as it is.';

const SUBTITLE =
  'Say what you’re planning: the stages work moves through and what each card should hold. You check the plan before anything is made.';

export function DescribePlanDialog({
  signedIn,
  signInHref,
  draft,
  plan,
  planTypes,
  onMake,
  onClose,
}: {
  // Describe a Plan is for signed-in people only (describe-a-plan.md "Who may"): a guest sees the nudge.
  signedIn: boolean;
  signInHref: string;
  // The api's Describe a Plan, for the person's words.
  draft: (prompt: string) => Promise<PlanDraftResponse>;
  // The plan the draft would join, for the preview's checks, and its card types, for the ones it keeps.
  plan: PlanDraftPlan;
  planTypes: readonly ItemTypeDef[];
  // Make Plan: makes the plan from the edited draft, answering why it couldn't (null: made).
  onMake: (draft: PlanDraft) => string | null;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  // The draft being checked: the preview shows while there is one.
  const [checking, setChecking] = useState<PlanDraft | null>(null);
  const [makeSaid, setMakeSaid] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // The ask in flight: a Cancel (or an unmount) makes its answer stale, and a stale answer is dropped.
  const asking = useRef(0);
  const titleId = useId();
  const noteId = useId();
  const saidId = useId();
  const examplesId = useId();
  const prompt = text.trim();

  useEffect(() => {
    box.current?.focus();
    return () => {
      asking.current += 1;
    };
  }, []);

  const problems = useMemo(
    () => (checking ? planDraftProblems(checking, plan) : []),
    [checking, plan],
  );
  const problemAt = useMemo(() => {
    const byPath = problemsByPath(problems);
    return (path: string) => byPath.get(path);
  }, [problems]);

  const submit = async () => {
    if (!prompt || busy) return;
    const mine = ++asking.current;
    setBusy(true);
    setSaid(null);
    try {
      const drafted = await draft(prompt);
      if (mine !== asking.current) return;
      setMakeSaid(null);
      setChecking(drafted.draft);
      // The preview's heading takes focus, so a screen reader hears the step change.
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) {
      if (mine !== asking.current) return;
      setSaid(error instanceof PlanDraftRefusal ? error.message : DESCRIBE_PLAN_FAILED);
      box.current?.focus();
    } finally {
      if (mine === asking.current) setBusy(false);
    }
  };

  const cancel = () => {
    asking.current += 1;
    onClose();
  };

  const back = () => {
    setChecking(null);
    requestAnimationFrame(() => box.current?.focus());
  };

  const make = () => {
    if (!checking || problems.length > 0) return;
    setMakeSaid(onMake(checking));
  };

  const title = (words: string) => (
    <span className="flex items-center gap-2">
      <SparkleIcon size={16} aria-hidden className="text-brand-700 dark:text-brand-300" />
      <span ref={heading} tabIndex={-1} className="outline-none">
        {words}
      </span>
    </span>
  );

  return (
    <Dialog
      open
      onClose={cancel}
      ariaLabel={checking ? 'Check Your Plan' : 'Describe a Plan'}
      size="xl"
      phoneSheet
      className="flex max-h-[min(46rem,90dvh)] flex-col"
    >
      <DialogHeader
        title={title(checking ? 'Check Your Plan' : 'Describe a Plan')}
        subtitle={checking ? undefined : signedIn ? SUBTITLE : undefined}
      >
        <DialogCloseButton onClick={cancel} />
      </DialogHeader>
      {!signedIn ? (
        <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            <SparkleIcon size={20} aria-hidden />
          </span>
          <p className="max-w-sm text-[14px] text-slate-700 dark:text-slate-200">
            {DESCRIBE_PLAN_SIGN_IN}
          </p>
        </div>
      ) : checking ? (
        <div
          data-describe-plan-preview=""
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 max-sm:px-4"
        >
          <PlanDraftPreview
            draft={checking}
            planTypes={planTypes}
            problemAt={problemAt}
            onChange={(next) => {
              setChecking(next);
              setMakeSaid(null);
            }}
            titleId={titleId}
          />
        </div>
      ) : (
        <div data-describe-plan="" className="flex flex-col gap-3 px-6 py-5 max-sm:px-4">
          <TextArea
            ref={box}
            aria-label="Describe the plan"
            aria-describedby={said ? `${saidId} ${noteId}` : noteId}
            aria-invalid={said ? true : undefined}
            rows={4}
            maxLength={PLAN_DRAFT_PROMPT_MAX}
            value={text}
            readOnly={busy}
            placeholder={DESCRIBE_PLAN_PLACEHOLDER}
            onChange={(e) => {
              setText(e.target.value);
              setSaid(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            className="resize-none"
          />
          <div className="-mt-1 flex justify-end">
            <span
              aria-live="polite"
              className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400"
            >
              {text.length} / {PLAN_DRAFT_PROMPT_MAX}
            </span>
          </div>
          <div role="group" aria-labelledby={examplesId} className="flex flex-col gap-2">
            <span
              id={examplesId}
              className="text-[12px] font-medium text-slate-500 dark:text-slate-400"
            >
              Try an Example
            </span>
            <div className="flex flex-wrap gap-2">
              {DESCRIBE_PLAN_EXAMPLES.map((e) => (
                <Button
                  key={e.label}
                  variant="secondary"
                  size="xs"
                  disabled={busy}
                  title={e.text}
                  onClick={() => {
                    setText(e.text);
                    setSaid(null);
                    box.current?.focus();
                  }}
                >
                  {e.label}
                </Button>
              ))}
            </div>
          </div>
          {said ? (
            <p
              id={saidId}
              role="alert"
              className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
            >
              {said}
            </p>
          ) : null}
          <AiNote id={noteId}>Uses AI: you can describe {PLAN_DRAFT_PER_DAY} plans a day.</AiNote>
        </div>
      )}
      <DialogFooter>
        {!signedIn ? (
          <>
            <Button variant="secondary" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => window.location.assign(signInHref)}>
              Sign In
            </Button>
          </>
        ) : checking ? (
          <>
            {problems.length > 0 || makeSaid ? (
              <span role="status" className="mr-auto text-[12px] text-rose-700 dark:text-rose-300">
                {makeSaid ??
                  (problems.length === 1
                    ? 'Fix the marked problem to make the plan.'
                    : `Fix the ${problems.length} marked problems to make the plan.`)}
              </span>
            ) : null}
            <Button variant="secondary" size="sm" onClick={back}>
              Back
            </Button>
            <Button variant="primary" size="sm" disabled={problems.length > 0} onClick={make}>
              Make Plan
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              busy={busy}
              disabled={!prompt}
              onClick={() => void submit()}
            >
              <SparkleIcon size={14} aria-hidden />
              {busy ? 'Drafting…' : 'Draft Plan'}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
