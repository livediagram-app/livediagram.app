'use client';

// The small Set by Automation chip under a field's value in the item panel (docs/specs/026-plan/automations.md "On
// cards"): the bolt in violet, so the reader knows a rule wrote it.

import { Chip } from '@liveplanner/ui';
import { BoltIcon } from './automation-glyphs';

export function SetByAutomationChip() {
  return (
    <Chip
      data-set-by-automation=""
      icon={<BoltIcon size={10} aria-hidden />}
      className="mt-1 bg-brand-50 px-1.5 py-px text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
    >
      Set by Automation
    </Chip>
  );
}
