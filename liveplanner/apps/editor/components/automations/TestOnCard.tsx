'use client';

// Test on a Card (docs/specs/026-plan/automations.md "The rule builder"): liveplanner's form of the platform's Test
// Rule. Pick a card with the card finder (CardPickerDialog, the plan's cards with the last changed first), and the
// rule as it stands in the builder, unsaved, is tried on it without changing anything; the result is the platform's
// (TestRuleResult): an Audit Trail row's result, how long it took and its steps, each action saying what it would
// do. Another Card goes back to the finder. The api answers a refusal that names a step (`automation_invalid` with a
// `path`) the same as a save's: the builder marks that step, so the test closes and hands it over.

import { useMemo, useState } from 'react';
import type { AutomationRuleBody } from '@liveplanner/items';
import type { TestDialogProps } from '@liveworkspace/automations-ui/kit';
import { TestRuleResult, useTestRun } from '@liveworkspace/automations-ui/TestRule';
import { CardPickerDialog } from '@/components/plan/CardPickerDialog';
import {
  byNewestChange,
  pickCardOf,
  useCardPickerSearch,
  type PickCard,
} from '@/components/plan/card-picker';
import type { AutomationOutline } from './automation-outline';

export function TestOnCard(props: TestDialogProps<AutomationRuleBody, AutomationOutline>) {
  const { outline, onClose } = props;
  const rows = useMemo(
    () => [...outline.items.values()].map((i) => pickCardOf(i, outline.types)).sort(byNewestChange),
    [outline.items, outline.types],
  );
  const picker = useCardPickerSearch(rows);
  const [card, setCard] = useState<PickCard | null>(null);
  const { phase, run, reset } = useTestRun(props);
  if (!card || phase.at === 'idle')
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
        onPick={(picked) => {
          setCard(picked);
          void run(picked.itemId);
        }}
        onClose={onClose}
      />
    );
  return (
    <TestRuleResult
      title="Test on a Card"
      subject={`${card.ref} ${card.title}`}
      running="Trying the rule on this card…"
      phase={phase}
      again={{ label: 'Another Card', onSelect: reset }}
      onClose={onClose}
    />
  );
}
