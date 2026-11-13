'use client';

// Test on a Card (docs/specs/026-plan/automations.md "The rule builder"): find a card of the plan, then the rule as
// it stands in the builder (saved or not) is tried on it as a dry run. The answer shows as a run does in the Run
// Log, its actions saying what they would do; nothing on the card changes. A refusal names the step at fault.

import { useMemo, useRef, useState } from 'react';
import type { AutomationRuleBody, AutomationRun } from '@liveplanner/items';
import { Button, DialogCloseButton, DialogFooter } from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { CardPickerDialog } from '@/components/plan/CardPickerDialog';
import {
  byNewestChange,
  pickCardOf,
  useCardPickerSearch,
  type PickCard,
} from '@/components/plan/card-picker';
import type { AutomationOutline } from './automation-outline';
import { AutomationRefusal } from './automations-client';
import { RunSteps } from './RunSteps';
import { ResultPill } from './RunRow';
import { tookWords } from './run-words';
import { goneText } from './needs-words';

type Phase =
  | { at: 'pick' }
  | { at: 'running'; card: PickCard }
  | { at: 'ran'; card: PickCard; run: AutomationRun }
  | { at: 'failed'; card: PickCard; message: string };

export function TestOnCard({
  body,
  outline,
  test,
  onRefused,
  onClose,
}: {
  body: AutomationRuleBody;
  outline: AutomationOutline;
  test: (rule: AutomationRuleBody, item: string) => Promise<{ run: AutomationRun }>;
  // The api refused the rule as it stands: the builder marks the step its path names.
  onRefused: (refusal: AutomationRefusal) => void;
  onClose: () => void;
}) {
  const rows = useMemo(
    () => [...outline.items.values()].map((i) => pickCardOf(i, outline.types)).sort(byNewestChange),
    [outline.items, outline.types],
  );
  const picker = useCardPickerSearch(rows);
  const [phase, setPhase] = useState<Phase>({ at: 'pick' });
  // The test in flight: Another Card makes its answer stale, and a stale answer is dropped.
  const trying = useRef(0);
  const another = () => {
    trying.current += 1;
    setPhase({ at: 'pick' });
  };

  const run = async (card: PickCard) => {
    const mine = ++trying.current;
    setPhase({ at: 'running', card });
    track('Plan', 'Tested', 'AutomationRule');
    try {
      const answer = await test(body, card.itemId);
      if (mine === trying.current) setPhase({ at: 'ran', card, run: answer.run });
    } catch (error) {
      debugLog('[automations] test.failed', { error: String(error) });
      if (mine !== trying.current) return;
      if (error instanceof AutomationRefusal && error.path) {
        onRefused(error);
        onClose();
        return;
      }
      setPhase({
        at: 'failed',
        card,
        message:
          error instanceof AutomationRefusal
            ? error.message
            : 'The test didn’t run. Check your connection and try again.',
      });
    }
  };

  if (phase.at === 'pick')
    return (
      <CardPickerDialog
        title="Test on a Card"
        description="Pick a card to try this rule on. It shows what the rule would do and changes nothing."
        cards={picker.shown}
        query={picker.query}
        onQuery={picker.setQuery}
        listLabel="Cards in this plan"
        emptyText="This plan has no cards to test on yet."
        showType={outline.types.length > 1}
        onPick={(card) => void run(card)}
        onClose={onClose}
      />
    );

  const card = phase.card;
  return (
    <Dialog open onClose={onClose} ariaLabel="Test on a Card" size="lg">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-6 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Test on a Card
          </h2>
          <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">
            #{card.key} {card.title}
          </p>
        </div>
        <DialogCloseButton onClick={onClose} />
      </div>
      <div className="flex flex-col gap-3 px-6 py-5" aria-live="polite">
        {phase.at === 'running' ? (
          <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
            Trying the rule on this card…
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
                {goneText(phase.run.reason, phase.run.gone)}
              </p>
            ) : null}
            <RunSteps steps={phase.run.steps} />
          </>
        )}
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={another}>
          Another Card
        </Button>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
