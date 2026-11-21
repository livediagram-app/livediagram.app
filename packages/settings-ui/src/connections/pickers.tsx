'use client';

import type { ReactNode, RefObject } from 'react';
import { GlyphDisc } from '@liveworkspace/ui';
import type { WebhookKind } from '@liveworkspace/index-client';
import { KindMark } from './marks';
import { KIND_ORDER, KINDS } from './connections-api';

// The add form's one choice (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): where it posts, each a
// bordered option with its mark, the chosen one in the site's own ink (slate, as its primary button and a focused
// field are), so the choice reads at a glance in light and dark. Native radios under the cards, so the arrow keys,
// Space and a screen reader's "2 of 3" come for free.

// The keyboard's ring on an option, drawn round the label that holds the hidden input.
const FOCUS =
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-400 has-[:focus-visible]:outline-solid dark:has-[:focus-visible]:outline-slate-400';
// A destination: a card that stands up on its own, its mark above its words from a small screen up, beside them on
// a phone. Chosen, it lifts: the ink ring and a soft shadow; hovered, its border darkens and a shadow comes in.
// A full-width row at every width: the mark at its left, the name and line beside it, the radio at its right.
const CARD = `group relative flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow] duration-micro ${FOCUS}`;
const CARD_ON =
  'border-slate-900 bg-white shadow-md shadow-slate-900/10 ring-1 ring-slate-900 dark:border-slate-100 dark:bg-slate-700/60 dark:shadow-black/30 dark:ring-slate-100';
const CARD_OFF =
  'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-500 dark:hover:bg-slate-700/40';

// The card's own mark of being chosen: a filled dot.
function Indicator({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-micro ${
        on
          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
          : 'border-slate-300 bg-white group-hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:group-hover:border-slate-500'
      }`}
    >
      {on ? <span className="size-1.5 rounded-full bg-white dark:bg-slate-900" /> : null}
    </span>
  );
}

/** A step of the form: its number, its question, and what answers it. */
export function FormStep({
  n,
  id,
  title,
  children,
}: {
  n: number;
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id} className="min-w-0">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <GlyphDisc
            size={20}
            aria-hidden
            className="bg-slate-900 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
          >
            {n}
          </GlyphDisc>
          <span id={id}>{title}</span>
        </p>
      </div>
      {children}
    </div>
  );
}

/** Where it posts: three cards, each its destination's tile, name and what arrives, the chosen one ringed. */
export function DestinationPicker({
  value,
  onChange,
  inputRef,
}: {
  // On the chosen one: where the keyboard lands as the form opens.
  inputRef?: RefObject<HTMLInputElement | null>;
  value: WebhookKind;
  onChange: (kind: WebhookKind) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {KIND_ORDER.map((kind) => {
        const on = value === kind;
        return (
          <label
            key={kind}
            data-destination={kind}
            data-chosen={on || undefined}
            className={`${CARD} ${on ? CARD_ON : CARD_OFF}`}
          >
            <input
              ref={on ? inputRef : undefined}
              type="radio"
              name="webhook-kind"
              checked={on}
              onChange={() => onChange(kind)}
              className="sr-only"
            />
            <KindMark kind={kind} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {KINDS[kind].label}
              </span>
              <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                {KINDS[kind].blurb}
              </span>
            </span>
            <span className="shrink-0">
              <Indicator on={on} />
            </span>
          </label>
        );
      })}
    </div>
  );
}
