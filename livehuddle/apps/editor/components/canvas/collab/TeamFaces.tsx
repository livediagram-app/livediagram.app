'use client';

import { useMemo, useState } from 'react';
import { CountBadge, Glyph, Tooltip } from '@livehuddle/ui';
import {
  CALENDAR_GRID,
  CALENDAR_HEADER,
  CALENDAR_WEEKDAYS,
  DEFAULT_NOTE_COLOR,
  localDay,
  NOTE_PAPER,
  OFFICE_ART,
  type ShapeElement,
} from '@livehuddle/document';
import { calendarMonth, cursorOf, monthTitle, WEEKDAY_INITIALS } from '@/lib/calendar-month';
import { useMinuteNow } from '@/lib/minute-clock';
import { pieceControlProps } from '@/lib/piece-control';
import { CalendarWallPopover, CalendarWallReader, notesByDay } from './CalendarWallPopover';
import { Overlay, PILL, ReaderHit } from './SocialFaces';
import { SuggestionBoxPopover, SuggestionBoxReader } from './SuggestionBoxPopover';

// The live faces of the Calendar Wall and the Suggestion Box (docs/specs/009-elements/team-pieces.md) laid over their
// art: the calendar's month on the viewer's clock with its notes' tabs and its Calendar button, and the box's Suggest
// button. Each opens its popover by the button, or large in the reader while walking. The month turns over on the
// one minute clock the World Clock reads (lib/minute-clock), so no calendar keeps a timer of its own.

/** Whether a kind has a team piece's live face over its art. */
export function hasTeamFace(kind: string): boolean {
  return kind === 'calendar-wall' || kind === 'suggestion-box';
}

export function TeamFace({
  element,
  walking = false,
}: {
  element: ShapeElement;
  walking?: boolean;
}) {
  if (element.shape === 'calendar-wall')
    return <CalendarWallFace element={element} walking={walking} />;
  if (element.shape === 'suggestion-box')
    return <SuggestionBoxFace element={element} walking={walking} />;
  return null;
}

// --- Calendar Wall ---------------------------------------------------------------------------------------------

function CalendarWallFace({ element, walking }: { element: ShapeElement; walking: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [reading, setReading] = useState(false);
  const now = useMinuteNow();
  // Zero before the clock is read (the server's render): the ruled sheet alone, as an export draws it.
  const today = now ? localDay(now) : null;
  const cells = useMemo(() => (today ? calendarMonth(cursorOf(today), today) : []), [today]);
  const byDay = useMemo(() => notesByDay(element.noticeNotes), [element.noticeNotes]);
  const count = element.noticeNotes?.length ?? 0;
  const art = OFFICE_ART['calendar-wall'].front;
  const { x, y, w, h, cols, rows } = CALENDAR_GRID;
  const cw = w / cols;
  const ch = h / rows;
  return (
    <Overlay element={element}>
      <svg
        viewBox={`0 0 ${art.width} ${art.height}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {today ? (
          <>
            <text
              x={CALENDAR_HEADER.x + CALENDAR_HEADER.w / 2}
              y={CALENDAR_HEADER.y + CALENDAR_HEADER.h / 2 + 5}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill="#fff"
            >
              {monthTitle(cursorOf(today))}
            </text>
            {WEEKDAY_INITIALS.map((d, i) => (
              <text
                key={i}
                x={CALENDAR_WEEKDAYS.x + cw * (i + 0.5)}
                y={CALENDAR_WEEKDAYS.y + CALENDAR_WEEKDAYS.h / 2 + 2.4}
                textAnchor="middle"
                fontSize={6.5}
                fontWeight={700}
                fill={i >= 5 ? '#b91c1c' : '#475569'}
              >
                {d}
              </text>
            ))}
            {cells.map((cell, i) => {
              const cx = x + (i % cols) * cw;
              const cy = y + Math.floor(i / cols) * ch;
              const notes = byDay.get(cell.day);
              const tone = notes?.[0]?.color ?? DEFAULT_NOTE_COLOR;
              return (
                <g key={cell.day} data-calendar-day={cell.day}>
                  {cell.isToday ? (
                    <circle
                      cx={cx + 7}
                      cy={cy + 6.4}
                      r={5}
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth={1.3}
                      data-calendar-today=""
                    />
                  ) : null}
                  <text
                    x={cx + 7}
                    y={cy + 8.8}
                    textAnchor="middle"
                    fontSize={6.5}
                    fontWeight={cell.isToday ? 700 : 500}
                    fill={cell.inMonth ? '#1e293b' : '#94a3b8'}
                  >
                    {cell.date}
                  </text>
                  {notes ? (
                    <g data-calendar-note="">
                      <path
                        d={`M${cx + cw - 10} ${cy + 1}h9v8l-4.5-2l-4.5 2z`}
                        fill={NOTE_PAPER[tone]}
                        stroke="#475569"
                        strokeWidth={0.5}
                      />
                      {notes.length > 1 ? (
                        <text
                          x={cx + cw - 5.5}
                          y={cy + ch - 2.5}
                          textAnchor="middle"
                          fontSize={5.5}
                          fontWeight={700}
                          fill="#334155"
                        >
                          {notes.length}
                        </text>
                      ) : null}
                    </g>
                  ) : null}
                </g>
              );
            })}
          </>
        ) : null}
      </svg>
      {walking ? <ReaderHit label="Open the Calendar" onOpen={() => setReading(true)} /> : null}
      <Tooltip label="Open Calendar">
        <button
          type="button"
          className={`${PILL} -top-[14px]`}
          aria-label={`Open Calendar, ${count} ${count === 1 ? 'note' : 'notes'}`}
          aria-expanded={anchor !== null}
          {...pieceControlProps}
          onClick={(e) => {
            e.stopPropagation();
            if (walking) {
              setReading(true);
              return;
            }
            const at = e.currentTarget;
            setAnchor((v) => (v ? null : at));
          }}
        >
          <CalendarGlyph />
          Calendar
          {count > 0 ? <CountBadge count={count} className="-my-1" /> : null}
        </button>
      </Tooltip>
      {anchor ? (
        <CalendarWallPopover element={element} anchor={anchor} onClose={() => setAnchor(null)} />
      ) : null}
      {reading ? <CalendarWallReader element={element} onClose={() => setReading(false)} /> : null}
    </Overlay>
  );
}

function CalendarGlyph() {
  return (
    <Glyph size={10} units={24}>
      <rect x={3} y={5} width={18} height={16} rx={2} />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Glyph>
  );
}

// --- Suggestion Box --------------------------------------------------------------------------------------------

function SuggestionBoxFace({ element, walking }: { element: ShapeElement; walking: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [reading, setReading] = useState(false);
  return (
    <Overlay element={element}>
      {walking ? (
        <ReaderHit label="Open the Suggestion Box" onOpen={() => setReading(true)} />
      ) : null}
      <Tooltip label="Drop an Idea">
        <button
          type="button"
          className={`${PILL} top-[calc(100%+3px)]`}
          aria-label="Open the Suggestion Box"
          aria-expanded={anchor !== null}
          {...pieceControlProps}
          onClick={(e) => {
            e.stopPropagation();
            if (walking) {
              setReading(true);
              return;
            }
            const at = e.currentTarget;
            setAnchor((v) => (v ? null : at));
          }}
        >
          <BulbGlyph />
          Suggest
        </button>
      </Tooltip>
      {anchor ? (
        <SuggestionBoxPopover element={element} anchor={anchor} onClose={() => setAnchor(null)} />
      ) : null}
      {reading ? <SuggestionBoxReader element={element} onClose={() => setReading(false)} /> : null}
    </Overlay>
  );
}

function BulbGlyph() {
  return (
    <Glyph size={10} units={24}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z" />
    </Glyph>
  );
}
