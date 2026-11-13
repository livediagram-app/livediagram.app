'use client';

// The Automations screen's Refresh (docs/specs/026-plan/automations.md "The Automations screen"): the refresh glyph
// alone, right beside the Runs today meter, a quiet icon button named Refresh by its tooltip and to screen readers.
// While a read is under way the glyph turns and the button is busy (it ignores a press and keeps focus), so a run of
// presses reads once at a time.

import { Button, RefreshIcon, Tooltip } from '@liveplanner/ui';

export const REFRESH_NAME = 'Refresh';
export const REFRESH_FAILED = 'Couldn’t refresh. Check your connection and try again.';

export function RefreshButton({ busy, onRefresh }: { busy: boolean; onRefresh: () => void }) {
  return (
    <Tooltip label={REFRESH_NAME}>
      <Button
        variant="ghost"
        size="xs"
        aria-label={REFRESH_NAME}
        data-automations-refresh=""
        busy={busy}
        onClick={onRefresh}
        className="touch-target relative size-7 shrink-0 cursor-pointer px-0"
      >
        <RefreshIcon
          size={14}
          aria-hidden
          className={busy ? 'animate-spin motion-reduce:animate-none' : undefined}
        />
      </Button>
    </Tooltip>
  );
}
