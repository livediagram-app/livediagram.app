'use client';

// Which Tab? (blueprint item-ui.md "Test Rule and Run Rule"): the one pick a test or a run by hand makes, where the
// rule is about a tab. It opens on the tab the person is on. An item with no tab says so, and offers nothing to run.

import { useTabWords } from './tab-words';
import { useState } from 'react';
import { Button, DialogCloseButton, DialogFooter, DialogHeader } from '@liveworkspace/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useAutomationsKit } from '../kit-context';
import { TabSelect } from './panels/panel-bits';

/** The tab a pick opens on: the person's own while the item still has it, else the first. '' with no tab. */
export function firstTab(tabs: readonly { id: string }[], current: string | null): string {
  return tabs.some((t) => t.id === current) ? current! : (tabs[0]?.id ?? '');
}

export function TabAskDialog({
  title,
  line,
  action,
  tabs,
  current,
  onPick,
  onClose,
}: {
  /** The dialog's name: "Test Rule", "Run Rule". */
  title: string;
  /** What the pick is for, under the title. */
  line: string;
  /** The button that goes on: "Test Rule", "Run Rule". */
  action: string;
  tabs: readonly { id: string; name: string }[];
  /** The tab the person is on. */
  current: string | null;
  onPick: (tab: string) => void;
  onClose: () => void;
}) {
  const { item } = useAutomationsKit().plumbing.words;
  const words = useTabWords();
  const [tab, setTab] = useState(() => firstTab(tabs, current));
  return (
    <Dialog open onClose={onClose} ariaLabel={title} size="sm">
      <DialogHeader title={title} subtitle={line}>
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="px-6 py-5">
        {tabs.length === 0 ? (
          <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
            {words(`This ${item} has no tabs yet. Add a tab, then try again.`)}
          </p>
        ) : (
          <TabSelect label={words('Tab')} value={tab} tabs={tabs} onChange={setTab} />
        )}
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!tab} onClick={() => onPick(tab)}>
          {action}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
