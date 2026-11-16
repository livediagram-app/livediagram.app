'use client';

// The kits to choose from (liveworkspace/docs/specs/010-site/site.md "Start a Project"): one card per kit, in the
// catalogue's order, as one radio group the arrows walk. A card lists its parts, each its app's logo, the part's name
// and the app's name. The chosen card takes the accent's deep shade and a tick.
import type { KeyboardEvent } from 'react';
import { KITS, type KitId } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideCheck } from '@liveworkspace/icons/lucide';
import { appName } from './kit-words';

const CheckGlyph = lucideGlyph(lucideCheck, 14);

export function KitCards({
  value,
  onChange,
  disabled = false,
}: {
  value: KitId;
  onChange: (kit: KitId) => void;
  disabled?: boolean;
}) {
  const index = KITS.findIndex((k) => k.id === value);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let to: number | null = null;
    if (e.key in step) to = (index + step[e.key]! + KITS.length) % KITS.length;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = KITS.length - 1;
    if (to === null) return;
    e.preventDefault();
    const next = KITS[to]!.id;
    onChange(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-kit="${next}"]`)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Kit"
      onKeyDown={disabled ? undefined : onKeyDown}
      className="grid gap-4 md:grid-cols-2"
    >
      {KITS.map((kit) => {
        const on = kit.id === value;
        return (
          <button
            key={kit.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={disabled || undefined}
            tabIndex={on ? 0 : -1}
            data-kit={kit.id}
            onClick={() => {
              if (!disabled) onChange(kit.id);
            }}
            className={`group relative flex cursor-pointer flex-col rounded-2xl border bg-white p-5 text-left transition-colors duration-micro outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 aria-disabled:cursor-default dark:bg-slate-900 dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-slate-950 ${
              on
                ? 'border-brand-700 shadow-sm ring-1 ring-brand-700 dark:border-brand-400 dark:ring-brand-400'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
            }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="text-base font-semibold text-slate-900 dark:text-white">
                {kit.title}
              </span>
              <span
                aria-hidden
                className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-micro ${
                  on
                    ? 'bg-brand-700 text-white dark:bg-brand-400 dark:text-slate-950'
                    : 'border border-slate-300 dark:border-slate-600'
                }`}
              >
                {on ? <CheckGlyph /> : null}
              </span>
            </span>
            <span className="mt-1 text-sm text-slate-600 dark:text-slate-400">{kit.summary}</span>
            <span className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {kit.parts.map((part) => (
                <span key={part.slot} className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800"
                  >
                    <BrandMark app={part.app} className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {part.name}
                    </span>
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {appName(part.app)}
                    </span>
                  </span>
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
