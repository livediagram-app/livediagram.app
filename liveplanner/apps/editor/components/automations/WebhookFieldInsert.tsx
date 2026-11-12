'use client';

// Webhook Field… in Insert a Value (docs/specs/026-plan/automations.md "Values"), offered only in an Incoming
// Webhook rule: the popover turns to a line for the path into the call's JSON (`build.status`, `items.0.name`, up to 5
// names) and Insert puts `{{webhook.<path>}}` at the caret. A path that can't be one says why and inserts nothing;
// Back (or Escape in the line) returns to the values.

import { useId, useState } from 'react';
import { WEBHOOK_PATH_DEPTH_MAX, WEBHOOK_VALUE_PREFIX, webhookPathOf } from '@liveplanner/items';
import { Button, FIELD_INVALID } from '@liveplanner/ui';

export function WebhookPathForm({
  onInsert,
  onBack,
}: {
  onInsert: (name: string) => void;
  onBack: () => void;
}) {
  const id = useId();
  const [path, setPath] = useState('');
  const [tried, setTried] = useState(false);
  const name = `${WEBHOOK_VALUE_PREFIX}${path.trim()}`;
  const valid = webhookPathOf(name) !== null;
  const insert = () => {
    setTried(true);
    if (valid) onInsert(name);
  };
  const wrong = tried && !valid;
  return (
    <div className="flex w-full flex-col gap-1.5 p-3">
      <label htmlFor={id} className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        Webhook Field
      </label>
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
            e.stopPropagation();
            onBack();
          }
        }}
        className={`h-9 min-w-0 rounded-md border bg-white px-2.5 font-mono text-[13px] text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/20 ${
          wrong ? FIELD_INVALID : 'border-slate-300 dark:border-slate-600'
        }`}
      />
      <p
        id={`${id}-hint`}
        role={wrong ? 'alert' : undefined}
        className={`text-[12px] ${wrong ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {wrong
          ? `Names of letters, digits, _ or -, joined by dots, up to ${WEBHOOK_PATH_DEPTH_MAX} deep.`
          : 'Where the value sits in the JSON the tool sends, joined by dots. A list item by its number, from 0.'}
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <Button size="xs" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="xs" onClick={insert}>
          Insert
        </Button>
      </div>
    </div>
  );
}
