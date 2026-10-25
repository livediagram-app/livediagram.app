'use client';

// What a board or Sheet not set up yet shows on the canvas (docs/specs/026-plan/plan-board.md "Setup Board",
// docs/specs/029-sheets/sheet.md "Setup Sheet"): calm and small, centred in its body: a glyph, its title, "Not set up
// yet", and for someone who may edit a button that opens the setup dialog. Who else has it selected the canvas's own
// selection badge names, as on any element.
import { forwardRef, type ReactNode } from 'react';
import { Button } from '@liveplanner/ui';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export const SetupPlaceholder = forwardRef<
  HTMLButtonElement,
  {
    icon: ReactNode;
    title: string;
    // The button's words ("Set up board"), or null for someone who may only view.
    action: string | null;
    onAction: () => void;
    // Read by someone who may only view, in the button's place.
    viewerLine: string;
    palette: PlanPalette;
  }
>(function SetupPlaceholder({ icon, title, action, onAction, viewerLine, palette }, ref) {
  return (
    <div
      data-setup-placeholder=""
      className="flex h-full min-h-full w-full flex-col items-center justify-center gap-2 px-6 py-8 text-center"
    >
      <span
        aria-hidden
        className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
      >
        {icon}
      </span>
      <p className="max-w-full truncate text-[15px] font-semibold" style={{ color: palette.text }}>
        {title}
      </p>
      <p className="text-[13px]" style={{ color: palette.muted }}>
        Not set up yet
      </p>
      {action ? (
        <Button
          ref={ref}
          variant="primary"
          size="sm"
          className="mt-2"
          // A press here is the button's, never the start of a drag of the element.
          onPointerDown={stop}
          onClick={onAction}
        >
          {action}
        </Button>
      ) : (
        <p className="text-[12px]" style={{ color: palette.muted }}>
          {viewerLine}
        </p>
      )}
    </div>
  );
});
