'use client';

// One event, as a card (spec/138 §2). Four regions, top to bottom: the
// preview box, the title row (subject + the host's menu slot), the
// reason line, and an optional description.
//
// The whole card is the click target. The two places a host can put its
// own interactive content, the menu slot and the title slot, stop their
// events at the slot boundary so a click on the ⋯ (or a keypress in a
// rename input) never also opens the diagram behind it.

import type { KeyboardEvent, MouseEvent } from 'react';
import { CARD_PREVIEW, CARD_SHELL } from '../cardGrid';
import { eventTone, toneColor, toneSoftColor } from './eventTone';
import { timeLabel } from './useTimelineGrouping';
import type { TimelineCardRender, TimelineCardSlots, TimelineEvent } from './types';

// Swallow anything that would otherwise bubble to the card's own
// handlers. A wrapper rather than asking each host slot to remember.
function stop(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

export function TimelineCard({
  event,
  rendered,
  slots,
  isNew,
  focused,
}: {
  event: TimelineEvent;
  rendered: TimelineCardRender;
  /** The host's additions: a ⋯ menu, an inline rename (spec/138 §2.8). */
  slots?: TimelineCardSlots;
  /** Landed since the reader last opened the feed (spec/138 §2.5). */
  isNew?: boolean;
  /** The deep-link target: ringed so the reader can see where they landed. */
  focused?: boolean;
}) {
  const subject = slots?.subject ?? rendered.subject ?? event.title;
  const label = rendered.label ?? event.title;
  // `undefined` means "renderer didn't say", so fall back to the stored
  // description; `null` means "renderer handled it", so show nothing. A
  // `??` here would collapse the two and re-print the subject under a
  // reason line that already names it.
  const description = rendered.description !== undefined ? rendered.description : event.description;
  const interactive = Boolean(rendered.onClick);
  // Colour by WHAT HAPPENED, not by which part of the product it
  // happened in: a reader scanning a busy day asks "is any of this
  // alarming?" before they ask "was that a diagram or a team".
  const tone = eventTone(event.eventType);

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={rendered.onClick}
      onContextMenu={slots?.onContextMenu}
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
      // The scroll target for a deep link. An attribute rather than a
      // ref because the card a link points at usually isn't mounted when
      // the link is followed.
      data-timeline-event={event.id}
      className={`${CARD_SHELL} ${
        focused ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-slate-900 ' : ''
      }${
        interactive
          ? 'cursor-pointer'
          : // Faded when there's nowhere to go. A card that looks
            // identical to a clickable one but ignores the click reads
            // as broken; dimming it answers the question before the
            // pointer gets there. A tombstone is the common case:
            // there is no diagram left to open.
            'opacity-60'
      }`}
    >
      <div className={`relative ${CARD_PREVIEW}`}>
        {rendered.preview ?? (
          // No picture to show, so the glyph stands in, large, on the
          // tone's tint: the box is the same height either way, which
          // is what keeps a row of mixed kinds aligned.
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center [&_svg]:h-10 [&_svg]:w-10"
            style={{ backgroundColor: toneSoftColor(tone), color: toneColor(tone) }}
          >
            {rendered.icon}
          </div>
        )}
        {isNew && (
          <span className="absolute left-2 top-2 rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white shadow-sm">
            New
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className="flex items-start gap-1">
          {slots?.title ? (
            <span className="min-w-0 flex-1" onClick={stop} onKeyDown={stop}>
              {slots.title}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {subject}
            </span>
          )}
          {slots?.menu ? (
            <span className="shrink-0" onClick={stop} onKeyDown={stop} onContextMenu={stop}>
              {slots.menu}
            </span>
          ) : null}
        </div>

        {/* The reason this card is on the feed, in the tone's colour so
            a day scans by what happened before it's read. */}
        <p
          className="flex items-center gap-1.5 text-xs font-medium [&_svg]:h-3.5 [&_svg]:w-3.5"
          style={{ color: toneColor(tone) }}
        >
          <span aria-hidden className="inline-flex shrink-0">
            {rendered.icon}
          </span>
          <span className="truncate">{label}</span>
        </p>

        {/* The time is always rendered, and always first: a day with
            twenty events is ordered but undated without it. The
            renderer's own meta trails it as running text, so a long one
            ("Rotate it before it lapses…") wraps word by word rather
            than being clipped or dropping whole onto its own line. */}
        <p className="break-words text-[10px] leading-snug text-slate-400 dark:text-slate-500">
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

        {description && (
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
