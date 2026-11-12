'use client';

// Webhook Field… in Insert a Value (docs/specs/026-plan/automations.md "Values"), offered only in an Incoming
// Webhook rule: a chip that opens a line for the path into the call's JSON (`build.status`, `items.0.name`, up to 5
// names) and puts `{{webhook.<path>}}` at the caret. A path that can't be one says why and inserts nothing.

import { useId, useState } from 'react';
import { WEBHOOK_PATH_DEPTH_MAX, WEBHOOK_VALUE_PREFIX, webhookPathOf } from '@liveplanner/items';
import { Button, FIELD_INVALID } from '@liveplanner/ui';

export const VALUE_CHIP_BUTTON =
  'touch-target-y relative rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium leading-[18px] text-slate-700 transition hover:bg-brand-50 hover:text-brand-700 motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-brand-500/15 dark:hover:text-brand-200';

/** The chip; open, the path line under the chips with Insert and Cancel. */
export function WebhookFieldInsert({ onInsert }: { onInsert: (name: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('');
  const [tried, setTried] = useState(false);
  const name = `${WEBHOOK_VALUE_PREFIX}${path.trim()}`;
  const valid = webhookPathOf(name) !== null;
  const close = () => {
    setOpen(false);
    setPath('');
    setTried(false);
  };
  const insert = () => {
    setTried(true);
    if (!valid) return;
    onInsert(name);
    close();
  };
  if (!open)
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className={VALUE_CHIP_BUTTON}
      >
        Webhook Field…
      </button>
    );
  const wrong = tried && !valid;
  return (
    <div className="flex w-full flex-col gap-1.5 pt-1">
      <label htmlFor={id} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        Webhook Field
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          id={id}
          autoFocus
          value={path}
          placeholder="build.status"
          spellCheck={false}
          aria-invalid={wrong || undefined}
          aria-describedby={`${id}-hint`}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              insert();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
          className={`min-w-0 flex-1 basis-40 rounded-md border bg-white px-2 py-1 font-mono text-[12px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/20 ${
            wrong ? FIELD_INVALID : 'border-slate-300 dark:border-slate-600'
          }`}
        />
        <Button size="xs" onClick={insert}>
          Insert
        </Button>
        <Button size="xs" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
      <p
        id={`${id}-hint`}
        role={wrong ? 'alert' : undefined}
        className={`text-[12px] ${wrong ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {wrong
          ? `Names of letters, digits, _ or -, joined by dots, up to ${WEBHOOK_PATH_DEPTH_MAX} deep.`
          : 'Where the value sits in the JSON the tool sends, joined by dots. A list item by its number, from 0.'}
      </p>
    </div>
  );
}
