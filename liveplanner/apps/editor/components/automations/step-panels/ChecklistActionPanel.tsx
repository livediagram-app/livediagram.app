'use client';

// Add a Checklist (docs/specs/026-plan/automations.md "Actions"): 1 to 20 items, each a line that may hold values,
// added unticked. An item the card's checklist already holds, by its text, is not added twice.

import {
  AUTOMATION_CHECKLIST_ITEMS_MAX,
  ITEM_CHECKLIST_TEXT_MAX,
  type AutomationAction,
} from '@liveplanner/items';
import { Button, CloseIcon, TextInput, Tooltip } from '@liveplanner/ui';

export function ChecklistActionPanel({
  action,
  onChange,
  invalid,
}: {
  action: AutomationAction & { kind: 'add_checklist' };
  onChange: (next: AutomationAction) => void;
  invalid: boolean;
}) {
  const items = action.items;
  const set = (next: string[]) => onChange({ kind: 'add_checklist', items: next });
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        Items
      </legend>
      <ol className="flex flex-col gap-1.5">
        {items.map((text, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-slate-300 dark:ring-slate-600"
            />
            <TextInput
              compact
              className="min-w-0 flex-1"
              aria-label={`Item ${i + 1}`}
              aria-invalid={invalid && !text.trim() ? true : undefined}
              maxLength={ITEM_CHECKLIST_TEXT_MAX}
              placeholder="What needs doing"
              value={text}
              onChange={(e) => set(items.map((t, j) => (j === i ? e.target.value : t)))}
            />
            <Tooltip label="Remove Item">
              <Button
                variant="ghost"
                size="xs"
                className="size-8 shrink-0 px-0"
                aria-label={`Remove Item ${i + 1}`}
                disabled={items.length <= 1}
                onClick={() => set(items.filter((_, j) => j !== i))}
              >
                <CloseIcon size={14} aria-hidden />
              </Button>
            </Tooltip>
          </li>
        ))}
      </ol>
      <Button
        variant="ghost"
        size="xs"
        className="self-start"
        disabled={items.length >= AUTOMATION_CHECKLIST_ITEMS_MAX}
        onClick={() => set([...items, ''])}
      >
        + Add Item
      </Button>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        Values like {'{{card.title}}'} work here. Items the card already has are skipped.
      </p>
    </fieldset>
  );
}
