'use client';

// Test Rule for an item's rules (blueprint item-ui.md "Test Rule and Run Rule"; automations.md "Test Rule and Run
// Rule"): a rule whose trigger is about a tab asks which tab first, on the one the person is on, then shows stage
// 3's result with the tab's name and Another Tab; any other rule runs at once on the item alone.

import type { ItemKinds } from '@liveworkspace/automations/item';
import { useState, type ComponentType } from 'react';
import type { TestDialogProps } from '../kit';
import { TestRuleDialog, TestRuleResult, useTestRun } from '../TestRule';
import type { RuleBody } from '../types';
import { TabAskDialog } from './TabAskDialog';
import type { ItemUiOutline } from './types';

type Props = TestDialogProps<RuleBody, ItemUiOutline>;

function TabbedTest(props: Props) {
  const { outline, onClose } = props;
  const { tabs, currentTabId } = outline.item;
  const [tab, setTab] = useState<string | null>(null);
  const { phase, run, reset } = useTestRun(props);
  if (tab === null || phase.at === 'idle')
    return (
      <TabAskDialog
        title="Test Rule"
        line="Pick a tab to try this rule on. It shows what the rule would do and changes nothing."
        action="Test Rule"
        tabs={tabs}
        current={tab ?? currentTabId}
        onPick={(picked) => {
          setTab(picked);
          void run(picked);
        }}
        onClose={onClose}
      />
    );
  return (
    <TestRuleResult
      title="Test Rule"
      subject={tabs.find((t) => t.id === tab)?.name ?? 'A tab'}
      running="Trying the rule on this tab…"
      phase={phase}
      again={{ label: 'Another Tab', onSelect: reset }}
      onClose={onClose}
    />
  );
}

/** The kit's Test, over the app's registry. */
export function itemTestRule(kinds: ItemKinds): ComponentType<Props> {
  return function ItemTestRule(props: Props) {
    return kinds.trigger(props.body.trigger.kind)?.tabbed ? (
      <TabbedTest {...props} />
    ) : (
      <TestRuleDialog {...props} />
    );
  };
}
