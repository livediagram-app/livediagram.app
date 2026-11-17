'use client';

// A tool opened inside the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Opening a tool
// inside Tools"; blueprint FM6): the shared back bar as the breadcrumb ("Tools", the tool's name in its chip) beside the
// popover's close, then the tool. A tool drawn by a dialog renders into the slot here (dialog-slot.ts, @liveworkspace/ui);
// until it arrives (its code loading) the loading sweep holds its place. Focus moves in as it opens: to the back bar,
// unless the tool has already taken it (a confirm's button).
import { useEffect, useRef, type ReactNode } from 'react';
import { BackBar, DialogCloseButton, LoadingSweep } from '@liveworkspace/ui';

export function ToolsView({
  id,
  label,
  onBack,
  onClose,
  tall,
  sheet,
  slotRef,
  waiting,
  children,
}: {
  id: string;
  label: string;
  onBack: () => void;
  onClose: () => void;
  /** A whole screen of a tool (Automations): a fixed height, so its own lists lay out and scroll as they did. */
  tall: boolean;
  sheet: boolean;
  /** Where a tool's dialog renders, for a tool that opens one. */
  slotRef?: (node: HTMLDivElement | null) => void;
  /** The tool's dialog has not arrived yet. */
  waiting: boolean;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // After the tool's own first render and its effects, so a control it focused keeps the focus.
    const frame = requestAnimationFrame(() => {
      const at = root.current;
      if (!at || at.contains(document.activeElement)) return;
      at.querySelector<HTMLElement>('[data-tools-back] button')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={root} data-tools-view={id} className="flex min-h-0 flex-1 flex-col">
      <div
        data-tools-back=""
        // Clear of a phone drawer's grab handle above it; level with the close beside it.
        className={`flex shrink-0 items-center gap-2 px-3 pb-2.5 ${sheet ? 'pt-1' : 'pt-3'}`}
      >
        <div className="min-w-0 flex-1">
          <BackBar label="Tools" current={label} onClick={onBack} gap="none" />
        </div>
        <DialogCloseButton compact onClick={onClose} />
      </div>
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain ${
          tall ? (sheet ? 'h-[75dvh]' : 'h-[min(44rem,calc(100dvh-7rem))]') : ''
        }`}
      >
        {waiting ? (
          <div role="status" aria-label={`Loading ${label}`} className="flex justify-center py-10">
            <LoadingSweep />
          </div>
        ) : null}
        {slotRef ? (
          <div
            ref={slotRef}
            data-tools-slot=""
            className={waiting ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
