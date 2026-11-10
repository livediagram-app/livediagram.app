'use client';

// The Map dialog's pins (docs/specs/009-elements/map.md "The Map dialog"): one row each, its label to type
// and a Remove button. A pin dropped on the preview focuses its row's label, ready to name.

import { useEffect, useRef } from 'react';
import { TextInput, Tooltip } from '@livedocuments/ui';
import type { MapPin } from '@livedocuments/document';

export function MapPinRows({
  pins,
  labelMax,
  focusId,
  onChange,
}: {
  pins: readonly MapPin[];
  labelMax: number;
  focusId: string | null;
  onChange: (pins: MapPin[]) => void;
}) {
  const fields = useRef(new Map<string, HTMLInputElement>());
  useEffect(() => {
    if (focusId) fields.current.get(focusId)?.focus();
  }, [focusId]);
  if (!pins.length)
    return (
      <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
        No pins yet. Find a place above, or switch to Place Pins and click the map.
      </p>
    );
  return (
    <ol className="mt-2 flex flex-col gap-1.5" aria-label="Pins">
      {pins.map((pin, i) => (
        <li key={pin.id} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="w-5 shrink-0 text-right text-[11px] tabular-nums text-slate-500 dark:text-slate-400"
          >
            {i + 1}
          </span>
          <TextInput
            compact
            ref={(node) => {
              if (node) fields.current.set(pin.id, node);
              else fields.current.delete(pin.id);
            }}
            aria-label={`Pin ${i + 1} label`}
            placeholder="No label"
            maxLength={labelMax}
            value={pin.label ?? ''}
            onChange={(e) =>
              onChange(pins.map((p) => (p.id === pin.id ? { ...p, label: e.target.value } : p)))
            }
            className="min-w-0 flex-1"
          />
          <Tooltip label={`Remove pin ${i + 1}`}>
            <button
              type="button"
              aria-label={`Remove pin ${i + 1}`}
              onClick={() => onChange(pins.filter((p) => p.id !== pin.id))}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition dark:text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <span aria-hidden>×</span>
            </button>
          </Tooltip>
        </li>
      ))}
    </ol>
  );
}
