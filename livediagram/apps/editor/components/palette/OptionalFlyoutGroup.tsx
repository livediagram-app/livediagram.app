'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { CountBadge } from '@livediagram/ui';
import { AccordionSection } from '@liveworkspace/workbench/components/primitives/AccordionSection';
import { useStoredOpen } from '@liveworkspace/workbench/hooks/ui/useStoredOpen';
import { track } from '@/lib/telemetry';

// An optional notation group in a category flyout (docs/specs/007-editor/toolbar-layout.md "Optional groups"): a
// header row, closed by default, that opens the group's tiles in place. Open or closed is remembered in this browser
// (useStoredOpen), so a person who opened BPMN finds it open after a reload until they close it again. The header is
// a flyout item, so the arrow keys reach it like a tile; a closed body is inert, so they skip its tiles.
// Hovering a closed group with a mouse PEEKS it open until the pointer leaves the group; pressing a tile in a peeked
// group (to place or drag it) or pressing the header keeps it open, as a click does (owner, 2026-11-19).

const PEEK_OPEN_DELAY_MS = 180;
const PEEK_CLOSE_DELAY_MS = 220;

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
  const [peek, setPeekNow] = useState(false);
  // Hover intent: a peek opens after the pointer rests a moment and closes a beat after it leaves, so passing over a
  // group on the way to another never flashes it open and shut.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setPeek = (next: boolean, delay = 0) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (delay === 0) setPeekNow(next);
    else timer.current = setTimeout(() => setPeekNow(next), delay);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const keep = () => {
    if (open) return;
    track('UI', 'Opened', telemetryType);
    setOpen(true);
  };
  const onToggle = () => {
    // A press on a peeked header keeps it open; on an open one, closes it.
    if (!open) keep();
    else {
      setOpen(false);
      setPeek(false);
    }
  };
  const mouse = (e: PointerEvent) => e.pointerType === 'mouse';
  return (
    <div
      onPointerEnter={(e) => {
        if (mouse(e) && !open) setPeek(true, PEEK_OPEN_DELAY_MS);
      }}
      onPointerLeave={(e) => {
        if (mouse(e)) setPeek(false, peek ? PEEK_CLOSE_DELAY_MS : 0);
      }}
      onPointerDownCapture={(e) => {
        // A tile pressed in a peeked group: the group was used, so it stays (the header's own press toggles).
        if (peek && !open && !(e.target as HTMLElement).closest('[data-optional-group]')) keep();
      }}
    >
      <AccordionSection
        title={title}
        open={open || peek}
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
        bodyClassName="px-0.5 pb-1.5 pt-1.5"
        motionClassName="duration-[250ms] ease-in-out motion-reduce:duration-0"
      >
        {children}
      </AccordionSection>
    </div>
  );
}
