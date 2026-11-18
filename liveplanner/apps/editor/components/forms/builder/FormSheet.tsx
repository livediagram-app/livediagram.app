'use client';

// A panel the form builder opens from a control in the form (docs/specs/030-forms/forms.md "Building a form"): Answer
// Goes To from a question's badge, Responses Go To and Settings from the status bar's cog. Anchored under (or over)
// its control on a wide screen; a bottom sheet on a phone, as the app's menus are.
import type { ReactNode } from 'react';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';

export function FormSheet({
  anchor,
  name,
  width = 340,
  titled = false,
  onClose,
  children,
}: {
  // The panel draws its own heading: a phone's sheet doesn't add the name above it.
  titled?: boolean;
  anchor: HTMLElement;
  // The panel's accessible name, and the heading a sheet shows.
  name: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const phone = useIsMobileViewport();
  if (phone)
    return (
      <BottomSheet
        role="dialog"
        aria-label={name}
        onClose={onClose}
        zClassName="z-[var(--z-overlay)]"
      >
        <div className="px-4 pb-4">
          {titled ? null : (
            <p className="pb-2 text-[13px] font-semibold text-slate-900 dark:text-slate-50">
              {name}
            </p>
          )}
          {children}
        </div>
      </BottomSheet>
    );
  return (
    <AnchoredPopover anchor={anchor} name={name} width={width} onClose={onClose}>
      <div className="max-h-[min(36rem,calc(100dvh-8rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-[13px] shadow-xl dark:border-slate-700 dark:bg-slate-900">
        {children}
      </div>
    </AnchoredPopover>
  );
}
