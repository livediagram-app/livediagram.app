'use client';

import type { ReactNode, RefObject } from 'react';
import { CheckIcon, GlyphDisc } from '@liveworkspace/ui';
import type { WebhookEvent, WebhookKind } from '@liveworkspace/index-client';
import { AppName, GroupGlyph, KindMark, PersonGlyph, TeamGlyph } from './marks';
import { EVENT_APP, EVENT_GROUPS, KIND_ORDER, KINDS } from './webhooks-api';

// The add form's choices (liveworkspace/docs/specs/010-site/site.md "Settings", Webhooks): where it posts, whose items
// and what it sends, each a bordered option tile with its mark, the chosen ones in the site's own ink (slate, as its
// primary button and a focused field are), so the choice reads at a glance in light and dark. Native
// radios and checkboxes under the tiles, so the arrow keys, Space and a screen reader's "2 of 3" come for free.

const TILE =
  'relative flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow] duration-micro has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-400 has-[:focus-visible]:outline-solid dark:has-[:focus-visible]:outline-slate-400';
const TILE_ON =
  'border-slate-900 bg-slate-50 shadow-sm ring-1 ring-slate-900 dark:border-slate-100 dark:bg-slate-700/50 dark:ring-slate-100';
// An event: a row in its group's card, split by hairlines as the Notifications' rows are; the ticked box says it.
const ROW =
  'relative flex min-w-0 cursor-pointer items-start gap-3 px-3.5 py-2.5 text-left transition-colors duration-micro hover:bg-slate-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-slate-400 has-[:focus-visible]:outline-solid dark:hover:bg-slate-700/40';
const TILE_OFF =
  'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-500 dark:hover:bg-slate-700/40';

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
          : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
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
  inputRef,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  leading?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  // Where the chosen mark sits: after the words (a destination), or before them (an event).
  indicator?: 'start' | 'end';
  // A bordered tile on its own, or a row in a card of them.
  look?: 'tile' | 'row';
  inputRef?: RefObject<HTMLInputElement | null> | undefined;
}) {
  return (
    <label className={look === 'row' ? ROW : `${TILE} ${checked ? TILE_ON : TILE_OFF}`}>
      <input
        ref={inputRef}
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
          className={`flex flex-wrap items-center gap-x-1.5 text-sm text-slate-900 dark:text-slate-50 ${
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
    <div className="grid gap-2 sm:grid-cols-3">
      {KIND_ORDER.map((kind) => (
        <OptionTile
          key={kind}
          type="radio"
          name="webhook-kind"
          checked={value === kind}
          onChange={() => onChange(kind)}
          inputRef={value === kind ? inputRef : undefined}
          leading={<KindMark kind={kind} size="sm" />}
          title={KINDS[kind].label}
          hint={KINDS[kind].blurb}
        />
      ))}
    </div>
  );
}

export type TeamChoice = { id: string; name: string };

/** Whose items it reports on: the person's own, or a team they run. `''` is their own. */
export function ScopePicker({
  teams,
  value,
  onChange,
}: {
  teams: readonly TeamChoice[];
  value: string;
  onChange: (scope: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <OptionTile
        type="radio"
        name="webhook-scope"
        checked={value === ''}
        onChange={() => onChange('')}
        leading={<ScopeMark team={false} />}
        title="Your Own Items"
        hint="What you make and own"
      />
      {teams.map((team) => (
        <OptionTile
          key={team.id}
          type="radio"
          name="webhook-scope"
          checked={value === team.id}
          onChange={() => onChange(team.id)}
          leading={<ScopeMark team />}
          title={<span className="min-w-0 truncate">{team.name}</span>}
          hint="The team’s items, for every admin to manage"
        />
      ))}
    </div>
  );
}

function ScopeMark({ team }: { team: boolean }) {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
    >
      {team ? <TeamGlyph /> : <PersonGlyph />}
    </span>
  );
}

/** What it sends: the events in their groups, each a row saying when it fires. */
export function EventPicker({
  value,
  onToggle,
}: {
  value: ReadonlySet<WebhookEvent>;
  onToggle: (event: WebhookEvent, on: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {EVENT_GROUPS.map((group) => (
        <div key={group.id} role="group" aria-labelledby={`webhook-events-${group.id}`}>
          <p
            id={`webhook-events-${group.id}`}
            className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            <GroupGlyph id={group.id} />
            {group.label}
          </p>
          <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-700/70 dark:border-slate-700 dark:bg-slate-800 [&>*:first-child]:rounded-t-[inherit] [&>*:last-child]:rounded-b-[inherit]">
            {group.events.map(({ event, label, hint }) => {
              const app = EVENT_APP[event];
              return (
                <OptionTile
                  key={event}
                  type="checkbox"
                  name={`webhook-event-${event}`}
                  checked={value.has(event)}
                  onChange={(on) => onToggle(event, on)}
                  indicator="start"
                  look="row"
                  title={
                    <>
                      {label}
                      {app ? <AppName app={app} /> : null}
                    </>
                  }
                  hint={hint}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
