'use client';

// A step in another app's Target field (blueprint cross-app.md "Picking the target"): the item it acts on, with its
// app, and Pick or Change opening the picker (TargetPicker). Picking keeps the item's title for the sentence, so the
// rule reads "Create a Card in “Launch”" without a read. The target's own lists (boards, pages, tabs, templates) are
// read once it is set (useCrossTarget), for the fields below it.
import { useState, type ReactNode } from 'react';
import type { App, AutomationTargetDescription } from '@liveworkspace/index-client';
import { appWord, type CrossAppTarget } from '@liveworkspace/automations/cross-app';
import { Button, lucideGlyph } from '@liveworkspace/ui';
import { lucideRefreshCw } from '@liveworkspace/icons/lucide';
import { useAutomationsAccess } from '../AutomationsContext';
import { useAutomationsKit } from '../kit-context';
import { useMinuteClock } from '../screen-clock';
import { PanelNote } from '../step-panels/panel-parts';
import { TargetPicker } from './TargetPicker';
import { useCrossTarget } from './use-cross-target';

const RetryGlyph = lucideGlyph(lucideRefreshCw, 13);

export function TargetField({
  target,
  apps,
  noun,
  invalid,
  onChange,
  children,
}: {
  target: CrossAppTarget;
  // The apps it may reach (Add a Tab to a Document: livedocuments or livediagram).
  apps: readonly App[];
  // What it names: "plan", "knowledgebase", "Space", "document".
  noun: string;
  invalid: boolean;
  onChange: (target: CrossAppTarget) => void;
  // The fields the target's lists feed, once read.
  children: (target: AutomationTargetDescription) => ReactNode;
}) {
  const { client } = useAutomationsKit().connections;
  const hostId = useAutomationsAccess()?.scope.itemId ?? '';
  const [open, setOpen] = useState(false);
  const now = useMinuteClock();
  const read = useCrossTarget(client, target.item);
  const Noun = `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">{Noun}</span>
        <div
          data-cross-target={target.item || undefined}
          aria-invalid={invalid || undefined}
          className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 ${
            invalid
              ? 'border-rose-400 dark:border-rose-500/70'
              : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-50">
              {target.item ? target.title || 'Untitled' : `No ${noun} picked`}
            </span>
            {target.item ? (
              <span className="text-[12px] text-slate-500 dark:text-slate-400">
                {appWord(target.app)}
              </span>
            ) : null}
          </span>
          <Button variant="secondary" size="xs" onClick={() => setOpen(true)}>
            {target.item ? 'Change' : `Pick a ${Noun}`}
          </Button>
        </div>
      </div>
      {read.state === 'failed' ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          <span>{`Couldn't read this ${noun}. You may have lost access to it.`}</span>
          <Button variant="secondary" size="xs" onClick={read.retry}>
            <RetryGlyph />
            Try Again
          </Button>
        </div>
      ) : read.state === 'loading' ? (
        <PanelNote>{`Reading the ${noun}…`}</PanelNote>
      ) : read.state === 'ready' ? (
        children(read.target)
      ) : null}
      {open ? (
        <TargetPicker
          client={client}
          hostId={hostId}
          apps={apps}
          noun={noun}
          now={now}
          onClose={() => setOpen(false)}
          onPick={(item) => {
            setOpen(false);
            onChange({ app: item.app, item: item.id, title: item.title });
          }}
        />
      ) : null}
    </div>
  );
}
