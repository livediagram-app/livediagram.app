'use client';

// The feed's parts: one day on the rail, one event's card, and a day's run of one kind folded into a stack.

import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { CARD_GRID, CARD_PREVIEW, CARD_SHELL, SOLID_BRAND_DARK_CONTROL } from '../ui/classes';
import { eventIcon } from './icons';
import {
  eventTone,
  stackLabel,
  timeLabel,
  TONE_INKS,
  toneColor,
  toneSoftColor,
  type TimelineCardRender,
  type TimelineCardSlots,
  type TimelineEvent,
  type TimelineRenderer,
  type TimelineStack,
} from './model';

// A day's cards. They are dealt in from 20px to the right, so the grid clips sideways, 8px clear of the cards so their
// focus rings and shadows still show: the deal never widens a phone's page, which would then pan sideways for good.
const DEAL_GRID = `${CARD_GRID} -mx-2 overflow-x-clip px-2`;

const SOLID_BRAND = `bg-brand-700 text-white ${SOLID_BRAND_DARK_CONTROL}`;
// ---------- One day ---------------------------------------------------------------------------------------------

export function TimelineGroup({
  label,
  year,
  isToday,
  isFuture,
  dateKey: key,
  pulse,
  children,
}: {
  label: string;
  year: string;
  isToday: boolean;
  isFuture?: boolean;
  dateKey: string;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    // The mini calendar finds a day by this attribute: the day it scrolls to may not be mounted when it renders.
    <section
      className="flex gap-3 md:gap-4"
      data-timeline-day={key}
      aria-label={`${label} ${year}`}
    >
      <div className="flex flex-shrink-0 flex-col items-center">
        <div
          className={`mt-3 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
            isToday
              ? 'bg-brand-500 ring-2 ring-brand-500/30'
              : isFuture
                ? 'bg-violet-400/60'
                : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
        <div
          className={`w-px flex-1 ${isFuture ? 'bg-violet-400/25' : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="mb-2 flex items-baseline gap-2 pt-1">
          {isToday ? (
            <span
              className={`inline-flex h-[19px] items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide ${SOLID_BRAND}`}
            >
              Today
            </span>
          ) : null}
          {isFuture ? (
            <span className="inline-flex h-[19px] items-center rounded bg-violet-500/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Upcoming
            </span>
          ) : null}
          <h2
            className={`whitespace-nowrap text-sm font-semibold ${
              isToday ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
            } ${pulse ? 'lw-tl-date-pulse' : ''}`}
          >
            {label}
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{year}</p>
        </div>
        <div className={DEAL_GRID}>{children}</div>
      </div>
    </section>
  );
}

// ---------- One event -------------------------------------------------------------------------------------------

function stop(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

/**
 * One event as a card: the preview box, the title, the reason line in the event's tone, and the time with its
 * detail. The whole card opens what it is about, through one real button stretched across it, so the slots above
 * it (a menu, a rename) are never controls nested in a control.
 */
export function TimelineCard({
  event,
  rendered,
  slots,
  isNew,
  focused,
}: {
  event: TimelineEvent;
  rendered: TimelineCardRender;
  slots?: TimelineCardSlots;
  isNew?: boolean;
  focused?: boolean;
}) {
  const subject = slots?.subject ?? rendered.subject ?? event.title;
  const label = rendered.label ?? event.title;
  const description = rendered.description ?? null;
  const interactive = Boolean(rendered.onClick);
  const nameOf = (node: unknown) => (typeof node === 'string' ? node : null);
  const buttonName = [nameOf(subject) ?? event.title, nameOf(label)].filter(Boolean).join(', ');
  // Coloured by what happened, so a busy day answers "is any of this alarming?" before it is read.
  const tone = eventTone(event.type);
  return (
    <div
      onClick={rendered.onClick}
      onContextMenu={slots?.onContextMenu}
      data-timeline-event={event.id}
      className={`${CARD_SHELL} h-full has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-brand-500 has-[>button:focus-visible]:ring-offset-1 dark:has-[>button:focus-visible]:ring-offset-slate-900 ${
        focused ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-slate-900 ' : ''
      } ${TONE_INKS}${interactive ? ' cursor-pointer' : ''}`}
    >
      {interactive ? (
        <button
          type="button"
          aria-label={buttonName}
          onClick={(e) => {
            e.stopPropagation();
            rendered.onClick?.();
          }}
          className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] outline-none"
        />
      ) : null}
      {/* Nothing to open: the picture is faded, never the words, which keep their contrast. */}
      <div className={`relative ${CARD_PREVIEW}${interactive ? '' : ' opacity-60'}`}>
        {rendered.preview ?? (
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center [&_svg]:h-10 [&_svg]:w-10"
            style={{ backgroundColor: toneSoftColor(tone), color: toneColor(tone) }}
          >
            {rendered.icon}
          </div>
        )}
        {isNew ? (
          <span
            className={`absolute left-2 top-2 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide shadow-sm ${SOLID_BRAND}`}
          >
            New
          </span>
        ) : null}
        {rendered.badge ? (
          <span className="pointer-events-none absolute right-2 top-2 inline-flex">
            {rendered.badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className="flex items-start gap-1">
          {slots?.title ? (
            <span className="relative z-10 min-w-0 flex-1" onClick={stop} onKeyDown={stop}>
              {slots.title}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {subject}
            </span>
          )}
          {slots?.menu ? (
            <span
              className="relative z-10 shrink-0"
              onClick={stop}
              onKeyDown={stop}
              onContextMenu={stop}
            >
              {slots.menu}
            </span>
          ) : null}
        </div>
        <p
          className="flex items-center gap-1.5 text-xs font-medium [&_svg]:h-3.5 [&_svg]:w-3.5"
          style={{ color: toneColor(tone) }}
        >
          <span aria-hidden className="inline-flex shrink-0">
            {rendered.icon}
          </span>
          <span className="truncate">{label}</span>
        </p>
        <p className="break-words text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          <time dateTime={new Date(event.occurredAt).toISOString()}>
            {timeLabel(event.occurredAt)}
          </time>
          {rendered.meta ? (
            <>
              <span aria-hidden> · </span>
              <span>{rendered.meta}</span>
            </>
          ) : null}
        </p>
        {description ? (
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A run of one kind on one day, collapsed or open: one cell of the grid wearing the run's headline, with faux
 * cards stepping out behind it. Its preview shows the kind's glyph, not one member's picture, which could not
 * speak for the run. The same card toggles the run in both states.
 */
export function StackedCard({
  stack,
  render,
  onToggle,
  expanded = false,
  isNew,
  stagger = 0,
  slots,
}: {
  stack: TimelineStack;
  render: TimelineRenderer;
  onToggle: () => void;
  expanded?: boolean;
  isNew?: boolean;
  stagger?: number;
  slots?: TimelineCardSlots;
}) {
  const anchor = stack.events[0]!;
  const rendered = render(anchor);
  const count = stack.events.length;
  const deep = count >= 3 && !expanded;
  const layer =
    'pointer-events-none absolute inset-0 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800';
  return (
    <div
      className="lw-tl-fan-out-up relative mb-3 mr-3 flex h-full flex-col"
      style={{ animationDelay: `${stagger}ms` }}
      data-timeline-stack={stack.key}
    >
      {deep ? (
        <div aria-hidden className={`${layer} translate-x-3 translate-y-3 opacity-50`} />
      ) : null}
      {!expanded ? (
        <div aria-hidden className={`${layer} translate-x-1.5 translate-y-1.5 opacity-75`} />
      ) : null}
      <div className="relative flex-1">
        <TimelineCard
          event={anchor}
          isNew={isNew}
          focused={expanded}
          slots={slots}
          rendered={{
            ...rendered,
            // The kind's own glyph: the anchor's (sparkles for an AI-made plan, say) would speak for the whole run.
            icon: eventIcon(anchor.type),
            subject: stackLabel(stack),
            label: `${count} events · click to ${expanded ? 'collapse' : 'expand'}`,
            description: null,
            meta: undefined,
            preview: undefined,
            badge: undefined,
            onClick: onToggle,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-2 inline-flex h-5 items-center rounded-full bg-slate-900/70 px-2 text-[11px] font-semibold text-white dark:bg-white/80 dark:text-slate-900"
        >
          {count}
        </span>
      </div>
    </div>
  );
}
