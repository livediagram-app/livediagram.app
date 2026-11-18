'use client';

import type { ReactNode } from 'react';
import { CountBadge } from '@livediagram/ui';
import { AccordionSection } from '@liveworkspace/workbench/components/primitives/AccordionSection';
import { useStoredOpen } from '@liveworkspace/workbench/hooks/ui/useStoredOpen';
import { track } from '@/lib/telemetry';

// An optional notation group in a category flyout (docs/specs/007-editor/toolbar-layout.md "Optional groups"): a
// header row, closed by default, that opens the group's tiles in place. Open or closed is remembered in this browser
// (useStoredOpen), so a person who opened BPMN finds it open after a reload until they close it again. The header is
// a flyout item, so the arrow keys reach it like a tile; a closed body is inert, so they skip its tiles.

export function OptionalFlyoutGroup({
  title,
  count,
  storageKey,
  telemetryType,
  children,
}: {
  title: string;
  count: number;
  storageKey: string;
  // Reported as `UI`/`Opened`/this when it opens (docs/specs/017-telemetry/telemetry.md), never on a close.
  telemetryType: string;
  children: ReactNode;
}) {
  const { open, setOpen } = useStoredOpen(storageKey);
  const onToggle = () => {
    if (!open) track('UI', 'Opened', telemetryType);
    setOpen(!open);
  };
  return (
    <AccordionSection
      title={title}
      open={open}
      onToggle={onToggle}
      headerProps={{ 'data-flyout-item': true, 'data-optional-group': title }}
      headerClassName={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left ring-1 transition pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 active:bg-slate-100 dark:active:bg-slate-800 ${
        open
          ? 'ring-transparent hover:bg-slate-50 hover:ring-slate-200 dark:hover:bg-slate-800/70 dark:hover:ring-slate-700'
          : 'bg-slate-50 ring-slate-200/80 hover:bg-white hover:shadow-sm hover:ring-slate-300 dark:bg-slate-800/60 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:ring-slate-600'
      }`}
      titleClassName="flex flex-1 items-center gap-2 text-[11px] font-semibold text-slate-600 after:h-px after:flex-1 after:bg-slate-200 after:content-[''] dark:text-slate-300 dark:after:bg-slate-700"
      trailing={<CountBadge count={count} label={`${count} elements`} />}
      chevronClassName="text-slate-500 dark:text-slate-400"
      bodyClassName="pt-1.5"
    >
      {children}
    </AccordionSection>
  );
}
