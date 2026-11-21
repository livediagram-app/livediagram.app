'use client';

// Test Rule (liveworkspace/docs/specs/018-automations/automations.md "Test Rule and Run Rule"): the rule as it
// stands in the builder, unsaved, run now without changing anything, its result shown as an Audit Trail row's steps,
// each action saying what it would do. TestRuleResult is the dialog every app's test ends in; useTestRun runs one
// test at a time (an answer to one left behind is dropped); TestRuleDialog is the whole test for an app with nothing
// to pick (it runs on the item alone). An app that picks what to test on (liveplanner: a card) draws its own picker
// first, then TestRuleResult.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, DialogCloseButton, DialogFooter } from '@liveworkspace/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { AutomationRefusal } from './automations-client';
import type { TestDialogProps } from './kit';
import { useAutomationsKit } from './kit-context';
import { ResultPill } from './RunRow';
import { RunSteps } from './RunSteps';
import { tookWords } from './run-words';
import type { ListedRun, RuleBody } from './types';

export type TestPhase =
  | { at: 'idle' }
  | { at: 'running' }
  | { at: 'ran'; run: ListedRun }
  | { at: 'failed'; message: string };

/** One test at a time: `run(subject)` tries the rule, `reset()` leaves the answer behind (another pick). */
export function useTestRun<Body extends RuleBody>({
  body,
  test,
  onRefused,
  onClose,
}: Pick<TestDialogProps<Body, unknown>, 'body' | 'test' | 'onRefused' | 'onClose'>): {
  phase: TestPhase;
  run: (subject: string | null) => Promise<void>;
  reset: () => void;
} {
  const { track } = useAutomationsKit().plumbing;
  const [phase, setPhase] = useState<TestPhase>({ at: 'idle' });
  // The run under way: an answer to one left behind is dropped.
  const trying = useRef(0);
  const reset = () => {
    trying.current += 1;
    setPhase({ at: 'idle' });
  };
  const run = async (subject: string | null) => {
    const mine = ++trying.current;
    setPhase({ at: 'running' });
    track('rule_tested');
    try {
      const answer = await test(body, subject);
      if (mine === trying.current) setPhase({ at: 'ran', run: answer.run });
    } catch (error) {
      debugLog('[automations] test.failed', { error: String(error) });
      if (mine !== trying.current) return;
      // A refusal naming a step is the builder's to show, on that step.
      if (error instanceof AutomationRefusal && error.path) {
        onRefused(error);
        onClose();
        return;
      }
      setPhase({
        at: 'failed',
        message:
          error instanceof AutomationRefusal
            ? error.message
            : 'The test didn’t run. Check your connection and try again.',
      });
    }
  };
  return { phase, run, reset };
}

/** The test's result: what it ran on, then the run's result, how long it took and its steps. */
export function TestRuleResult({
  title,
  subject,
  running,
  phase,
  again,
  onClose,
}: {
  // The test's name: "Test Rule", or the app's own.
  title: string;
  // What it ran on, under the title ("#12 Fix login"); none for the item alone.
  subject?: ReactNode;
  // The line while it runs ("Trying the rule on this card…").
  running: string;
  phase: Exclude<TestPhase, { at: 'idle' }>;
  // Back to the pick, or the same test once more.
  again: { label: string; onSelect: () => void };
  onClose: () => void;
}) {
  const { sentence } = useAutomationsKit();
  return (
    <Dialog open onClose={onClose} ariaLabel={title} size="lg">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-6 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subject ? (
            <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">{subject}</p>
          ) : null}
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>
      <div className="flex flex-col gap-3 px-6 py-5" aria-live="polite">
        {phase.at === 'running' ? (
          <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
            {running}
          </p>
        ) : phase.at === 'failed' ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {phase.message}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
              <ResultPill result={phase.run.result} />
              {tookWords(phase.run.tookMs)} · A test changes nothing
            </div>
            {phase.run.reason ? (
              <p className="text-[13px] text-amber-800 dark:text-amber-300">
                {sentence.gone(phase.run.reason, phase.run.gone)}
              </p>
            ) : null}
            <RunSteps steps={phase.run.steps} />
          </>
        )}
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={again.onSelect}>
          {again.label}
        </Button>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** The whole test for an app with nothing to pick: it runs on the item alone, as it opens. */
export function TestRuleDialog<Body extends RuleBody>(props: TestDialogProps<Body, unknown>) {
  const { words } = useAutomationsKit().plumbing;
  const { phase, run } = useTestRun(props);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run(null);
  });
  return (
    <TestRuleResult
      title={words.test}
      running="Trying the rule…"
      phase={phase.at === 'idle' ? { at: 'running' } : phase}
      again={{ label: 'Test Again', onSelect: () => void run(null) }}
      onClose={props.onClose}
    />
  );
}
