'use client';

import { useId, type ReactNode, type RefObject } from 'react';
import { CheckIcon, GlyphDisc } from '@liveworkspace/ui';
import type { App, WebhookEvent, WebhookKind, WebhookWho } from '@liveworkspace/index-client';
import { GroupGlyph, KindMark, PersonGlyph, TeamGlyph } from './marks';
import { eventGroupsFor, KIND_ORDER, KINDS, WHO_CHOICES } from './webhooks-api';

// The add form's choices (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): where it posts, what it
// sends and whose changes, each a bordered option with its mark, the chosen ones in the site's own ink (slate, as its
// primary button and a focused field are), so the choice reads at a glance in light and dark. Native radios and
// checkboxes under the tiles, so the arrow keys, Space and a screen reader's "2 of 3" come for free.

// The keyboard's ring on an option, drawn round the label that holds the hidden input.
const FOCUS =
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-400 has-[:focus-visible]:outline-solid dark:has-[:focus-visible]:outline-slate-400';
const TILE = `relative flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow] duration-micro ${FOCUS}`;
const TILE_ON =
  'border-slate-900 bg-slate-50 shadow-sm ring-1 ring-slate-900 dark:border-slate-100 dark:bg-slate-700/50 dark:ring-slate-100';
const TILE_OFF =
  'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-500 dark:hover:bg-slate-700/40';
// An event: a row in the events' card, split by hairlines as the Notifications' rows are; the ticked box says it.
const ROW =
  'relative flex min-w-0 cursor-pointer items-start gap-3 px-3.5 py-2.5 text-left transition-colors duration-micro hover:bg-slate-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-slate-400 has-[:focus-visible]:outline-solid dark:hover:bg-slate-700/40';
// A destination: a card that stands up on its own, its mark above its words from a small screen up, beside them on
// a phone. Chosen, it lifts: the ink ring and a soft shadow; hovered, its border darkens and a shadow comes in.
const CARD = `group relative flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-micro sm:flex-col sm:items-start sm:p-4 ${FOCUS}`;
const CARD_ON =
  'border-slate-900 bg-white shadow-md shadow-slate-900/10 ring-1 ring-slate-900 dark:border-slate-100 dark:bg-slate-700/60 dark:shadow-black/30 dark:ring-slate-100';
const CARD_OFF =
  'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-500 dark:hover:bg-slate-700/40';
// The card the events sit in.
const EVENTS_CARD =
  'overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800';

/** A small text button: Select All, Clear, Edit Events. */
export const TEXT_BUTTON =
  'relative touch-target-y cursor-pointer rounded text-xs font-semibold text-slate-600 underline-offset-2 transition-colors duration-micro hover:text-slate-900 hover:underline disabled:cursor-default disabled:opacity-40 disabled:no-underline dark:text-slate-300 dark:hover:text-white';

// The tile's own mark of being chosen: a filled dot for one of several, a ticked box for any of several.
function Indicator({ type, on }: { type: 'radio' | 'checkbox'; on: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex size-[18px] shrink-0 items-center justify-center border transition-colors duration-micro ${
        type === 'radio' ? 'rounded-full' : 'rounded-[5px]'
      } ${
        on
          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
          : 'border-slate-300 bg-white group-hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:group-hover:border-slate-500'
      }`}
    >
      {on ? (
        type === 'radio' ? (
          <span className="size-1.5 rounded-full bg-white dark:bg-slate-900" />
        ) : (
          <CheckIcon size={12} weight={2.25} />
        )
      ) : null}
    </span>
  );
}

function OptionTile({
  type,
  name,
  checked,
  onChange,
  leading,
  title,
  hint,
  indicator = 'end',
  look = 'tile',
}: {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  leading?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  // Where the chosen mark sits: after the words (Who Did It), or before them (an event).
  indicator?: 'start' | 'end';
  // A bordered tile on its own, or a row in a card of them.
  look?: 'tile' | 'row';
}) {
  return (
    <label className={look === 'row' ? ROW : `${TILE} ${checked ? TILE_ON : TILE_OFF}`}>
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {indicator === 'start' ? <Indicator type={type} on={checked} /> : null}
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-900 dark:text-slate-50 ${
            look === 'row' ? 'font-medium' : 'font-semibold'
          }`}
        >
          {title}
        </span>
        {hint ? (
          <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">{hint}</span>
        ) : null}
      </span>
      {indicator === 'end' ? <Indicator type={type} on={checked} /> : null}
    </label>
  );
}

/** A step of the form: its number, its question, and what answers it. */
export function FormStep({
  n,
  id,
  title,
  aside,
  children,
}: {
  n: number;
  id: string;
  title: string;
  // Beside the question: Select All and Clear.
  aside?: ReactNode;
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
        {aside}
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
    <div className="grid gap-2.5 sm:grid-cols-3">
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
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:pr-6">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {KINDS[kind].label}
              </span>
              <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                {KINDS[kind].blurb}
              </span>
            </span>
            <span className="shrink-0 sm:absolute sm:right-3.5 sm:top-3.5">
              <Indicator type="radio" on={on} />
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Whose changes it posts: anyone's, or only those of whoever adds it. */
export function WhoPicker({
  value,
  onChange,
}: {
  value: WebhookWho;
  onChange: (who: WebhookWho) => void;
}) {
  // Each picker's own radio group: two webhooks' editors open at once must never share one.
  const name = `webhook-who-${useId()}`;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {WHO_CHOICES.map(({ who, label, hint }) => (
        <OptionTile
          key={who}
          type="radio"
          name={name}
          checked={value === who}
          onChange={() => onChange(who)}
          leading={<WhoMark who={who} />}
          title={label}
          hint={hint}
        />
      ))}
    </div>
  );
}

function WhoMark({ who }: { who: WebhookWho }) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
    >
      {who === 'me' ? <PersonGlyph /> : <TeamGlyph />}
    </span>
  );
}

/** How many of `events` a set holds: one pass over the few events given. */
export function countChosen(events: readonly WebhookEvent[], value: ReadonlySet<WebhookEvent>) {
  let chosen = 0;
  for (const event of events) if (value.has(event)) chosen++;
  return chosen;
}

/** Select All and Clear over the events given, with "4 of 9" before them. */
export function EventControls({
  events,
  value,
  onChange,
}: {
  events: readonly WebhookEvent[];
  value: ReadonlySet<WebhookEvent>;
  onChange: (next: Set<WebhookEvent>) => void;
}) {
  const chosen = countChosen(events, value);
  return (
    <span className="flex shrink-0 items-center gap-3">
      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
        {chosen} of {events.length}
      </span>
      <button
        type="button"
        className={TEXT_BUTTON}
        disabled={chosen === events.length}
        onClick={() => onChange(new Set(events))}
      >
        Select All
      </button>
      <button
        type="button"
        className={TEXT_BUTTON}
        disabled={chosen === 0}
        onClick={() => onChange(new Set())}
      >
        Clear
      </button>
    </span>
  );
}

/**
 * What it sends: the document's app's events in their groups, as checkable rows in one card, each named in that
 * app's words ("Canvas Renamed"). The dialog is the document's, so no row names an app.
 */
export function EventPicker({
  app,
  value,
  onChange,
}: {
  app: App;
  value: ReadonlySet<WebhookEvent>;
  onChange: (next: Set<WebhookEvent>) => void;
}) {
  const toggle = (event: WebhookEvent, on: boolean) => {
    const next = new Set(value);
    if (on) next.add(event);
    else next.delete(event);
    onChange(next);
  };
  // Each picker's own heading ids, so two at once (two webhooks' editors) each name their groups.
  const idPrefix = useId();
  return (
    <div data-webhook-events="" className={`${EVENTS_CARD} flex flex-col pb-1`}>
      {eventGroupsFor(app).map((group) => (
        <div key={group.id} role="group" aria-labelledby={`${idPrefix}-events-${group.id}`}>
          <p
            id={`${idPrefix}-events-${group.id}`}
            className="flex items-center gap-1.5 px-3.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            <GroupGlyph id={group.id} />
            {group.label}
          </p>
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700/70">
            {group.events.map(({ event, label, hint }) => (
              <OptionTile
                key={event}
                type="checkbox"
                name={`webhook-event-${event}`}
                checked={value.has(event)}
                onChange={(on) => toggle(event, on)}
                indicator="start"
                look="row"
                title={label}
                hint={hint}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
