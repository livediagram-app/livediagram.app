'use client';

// One event (spec/138 §2). Four regions, in a fixed order: the icon
// strip, the content, an optional preview, and the action strip.
//
// The action strip exists even when it's empty. Every per-event control
// belongs there — a star, a dismiss, an Open — so that "things you can
// do to this event" has one predictable home instead of a button
// floating somewhere in the content row.

import { eventTone, toneColor, toneSoftColor } from './eventTone';
import { timeLabel } from './useTimelineGrouping';
import type { TimelineBubbleRender, TimelineEvent } from './types';

export function TimelineBubble({
  event,
  rendered,
  isNew,
}: {
  event: TimelineEvent;
  rendered: TimelineBubbleRender;
  /** Landed since the reader last opened the feed (spec/138 §2.5). */
  isNew?: boolean;
}) {
  const label = rendered.label ?? event.title;
  // `undefined` means "renderer didn't say", so fall back to the stored
  // description; `null` means "renderer handled it", so show nothing. A
  // `??` here would collapse the two and re-print the subject under a
  // headline that already names it.
  const description = rendered.description !== undefined ? rendered.description : event.description;
  const interactive = Boolean(rendered.onClick);
  const actions = rendered.actions ?? [];
  // Colour by WHAT HAPPENED, not by which part of the product it
  // happened in: a reader scanning a busy day asks "is any of this
  // alarming?" before they ask "was that a diagram or a team".
  const tone = eventTone(event.eventType);

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={rendered.onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                rendered.onClick?.();
              }
            }
          : undefined
      }
      className={`group relative flex w-full items-stretch overflow-hidden rounded-lg transition ${
        interactive
          ? 'cursor-pointer hover:brightness-[0.97] dark:hover:brightness-125'
          : // Faded when there's nowhere to go. A row that looks
            // identical to a clickable one but ignores the click reads
            // as broken; dimming it answers the question before the
            // pointer gets there. A tombstone is the common case —
            // there is no diagram left to open.
            'opacity-60'
      }`}
      // Every bubble of the same tone gets the SAME tint. An alternating
      // stripe would make two events of one kind look like two
      // different kinds, which is the opposite of what colour is doing.
      style={{ backgroundColor: toneSoftColor(tone) }}
    >
      <div
        className="flex w-11 flex-shrink-0 items-center justify-center border-r border-slate-900/5 dark:border-white/5"
        style={{ color: toneColor(tone) }}
      >
        {rendered.icon}
      </div>

      <div className="min-w-0 flex-1 px-3 py-3">
        <p className="break-words text-sm text-slate-800 dark:text-slate-100">
          {isNew && (
            <span className="mr-1.5 inline-flex -translate-y-px items-center rounded bg-brand-600 px-1 py-px align-middle text-[9px] font-semibold uppercase tracking-wider text-white">
              New
            </span>
          )}
          {label}
        </p>
        {description && (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-400">
            {description}
          </p>
        )}
        {/* The time is always rendered, and always first: a day with
            twenty events is ordered but undated without it, so you can
            see THAT Priya commented but not whether it was before or
            after your rename. The renderer's own meta trails it. */}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <time dateTime={new Date(event.occurredAt).toISOString()}>
            {timeLabel(event.occurredAt)}
          </time>
          {rendered.meta ? (
            <>
              <span aria-hidden>·</span>
              <span>{rendered.meta}</span>
            </>
          ) : null}
        </p>
      </div>

      {/* Preview, for events that have something to show. `self-center`
          plus a fixed height keeps it inside the row the content
          already defines — a preview that sets the row height would
          make every diagram bubble taller than every other kind. */}
      {rendered.preview && (
        <div className="flex flex-shrink-0 items-center pr-2">{rendered.preview}</div>
      )}

      {actions.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-0.5 pr-1.5">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              aria-label={action.label}
              onClick={(e) => {
                // The whole bubble is usually clickable; an action
                // button inside it must not also trigger that.
                e.stopPropagation();
                action.onClick();
              }}
              // Hover-revealed, but focus-visible brings it back for
              // keyboard users, who have no hover to give.
              className="rounded p-1.5 text-slate-500 opacity-0 transition hover:bg-slate-900/5 focus-visible:opacity-100 group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-white/10"
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
