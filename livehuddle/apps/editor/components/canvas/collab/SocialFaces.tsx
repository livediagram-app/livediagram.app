'use client';

import { useState, type ReactNode } from 'react';
import { CountBadge, Glyph, Tooltip } from '@livehuddle/ui';
import { drawnRect } from '@liveworkspace/avatar/seats';
import {
  CLOCK_DIALS_ON_FACE,
  CLOCK_FACE,
  DEFAULT_NOTE_COLOR,
  NOTE_PAPER,
  NOTES_ON_FACE,
  NOTICE_CORK,
  OFFICE_ART,
  notesNewestFirst,
  type ClockZone,
  type ShapeElement,
} from '@livehuddle/document';
import { useMinuteNow } from '@/lib/minute-clock';
import { pieceControlProps } from '@/lib/piece-control';
import {
  toggleJukeboxListening,
  useJukeboxFailed,
  useJukeboxListening,
} from '@/lib/jukebox-listening';
import { useNearArcade } from './useSocialPieces';
import { NoticeBoardPopover } from './NoticeBoardPopover';

// The live faces of the social pieces (docs/specs/009-elements/social-pieces.md) laid over their art: the Notice
// Board's cards and Notes button, the World Clock's dials, the Jukebox's Play / Mute button and the Arcade Machine's
// Insert Coin bubble. Each lies over the drawn rectangle of its piece (the art is fitted whole and centred), and
// draws in the piece's own grid, so it scales with the piece and the canvas.

/** Whether a kind has a live face over its art. */
export function hasSocialFace(kind: string): boolean {
  return (
    kind === 'notice-board' ||
    kind === 'world-clock' ||
    kind === 'jukebox' ||
    kind === 'arcade-machine'
  );
}

export function SocialFace({ element }: { element: ShapeElement }) {
  switch (element.shape) {
    case 'notice-board':
      return <NoticeBoardFace element={element} />;
    case 'world-clock':
      return <WorldClockFace element={element} />;
    case 'jukebox':
      return <JukeboxFace element={element} />;
    case 'arcade-machine':
      return <ArcadeBubble id={element.id} />;
    default:
      return null;
  }
}

// The piece's drawn rectangle inside its box, as percentages, with the grid's viewBox for an SVG over it.
function Overlay({ element, children }: { element: ShapeElement; children: ReactNode }) {
  const art = OFFICE_ART[element.shape as keyof typeof OFFICE_ART];
  const grid = art?.front ?? { width: element.width, height: element.height };
  const r = drawnRect({ x: 0, y: 0, width: element.width, height: element.height }, grid);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: pct(r.x, element.width),
        top: pct(r.y, element.height),
        width: pct(r.width, element.width),
        height: pct(r.height, element.height),
      }}
    >
      {children}
    </div>
  );
}

// A press on a face's control is the control's, never the start of a drag, a selection, a label edit or a walk on
// the canvas (pieceControlProps).

const PILL =
  'pointer-events-auto absolute left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-slate-300 bg-white/95 px-2 py-[2px] text-[9px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-100 dark:hover:bg-slate-700';

// --- Notice Board -------------------------------------------------------------------------------------------

// Up to `max` characters of a line, an ellipsis when cut.
function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}

function NoticeBoardFace({ element }: { element: ShapeElement }) {
  // The Notes button while its popover is open: the popover's anchor.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const notes = notesNewestFirst(element.noticeNotes);
  const shown = notes.slice(0, NOTES_ON_FACE);
  const more = notes.length - shown.length;
  const art = OFFICE_ART['notice-board'].front;
  const { x, y, w, h } = NOTICE_CORK;
  const cw = (w - 18) / 2;
  const ch = (h - 18) / 2;
  const tilt = [-2.5, 2, 1.5, -2];
  return (
    <Overlay element={element}>
      <svg
        viewBox={`0 0 ${art.width} ${art.height}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {shown.length === 0 ? (
          <text
            x={x + w / 2}
            y={y + h / 2 + 3}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill="#7c4a1e"
            opacity={0.8}
          >
            No Notes Yet
          </text>
        ) : (
          shown.map((note, i) => {
            const cx = x + 6 + (i % 2) * (cw + 6);
            const cy = y + 6 + Math.floor(i / 2) * (ch + 6);
            const title = note.title?.trim() || note.text;
            return (
              <g
                key={note.id}
                transform={`rotate(${tilt[i]} ${cx + cw / 2} ${cy + ch / 2})`}
                data-note-card=""
              >
                <rect
                  x={cx + 1}
                  y={cy + 2}
                  width={cw}
                  height={ch}
                  rx={1.5}
                  fill="#000"
                  opacity={0.12}
                />
                <rect
                  x={cx}
                  y={cy}
                  width={cw}
                  height={ch}
                  rx={1.5}
                  fill={NOTE_PAPER[note.color ?? DEFAULT_NOTE_COLOR]}
                />
                <circle
                  cx={cx + cw / 2}
                  cy={cy + 4}
                  r={2.4}
                  fill="#dc2626"
                  stroke="#7f1d1d"
                  strokeWidth={0.6}
                />
                <text x={cx + 5} y={cy + 16} fontSize={8} fontWeight={700} fill="#1f2937">
                  {clip(title, 15)}
                </text>
                {note.title?.trim() ? (
                  <text x={cx + 5} y={cy + 27} fontSize={6.5} fill="#374151">
                    {clip(note.text, 20)}
                  </text>
                ) : null}
                <text x={cx + 5} y={cy + ch - 5} fontSize={5.5} fill="#6b7280">
                  {clip(note.author, 22)}
                </text>
              </g>
            );
          })
        )}
        {more > 0 ? (
          <g>
            <rect
              x={x + w - 40}
              y={y + h - 11}
              width={36}
              height={10}
              rx={5}
              fill="#1f2937"
              opacity={0.75}
            />
            <text
              x={x + w - 22}
              y={y + h - 3.6}
              textAnchor="middle"
              fontSize={6.5}
              fontWeight={700}
              fill="#fff"
            >
              +{more} More
            </text>
          </g>
        ) : null}
      </svg>
      <Tooltip label="Open Notes">
        <button
          type="button"
          className={`${PILL} -top-[14px]`}
          aria-label={`Open Notes, ${notes.length} pinned`}
          aria-expanded={anchor !== null}
          {...pieceControlProps}
          onClick={(e) => {
            e.stopPropagation();
            const at = e.currentTarget;
            setAnchor((v) => (v ? null : at));
          }}
        >
          <PinGlyph />
          Notes
          {notes.length > 0 ? <CountBadge count={notes.length} className="-my-1" /> : null}
        </button>
      </Tooltip>
      {anchor ? (
        <NoticeBoardPopover element={element} anchor={anchor} onClose={() => setAnchor(null)} />
      ) : null}
    </Overlay>
  );
}

function PinGlyph() {
  return (
    <Glyph size={10} units={24}>
      <path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z" />
    </Glyph>
  );
}

// --- World Clock ---------------------------------------------------------------------------------------------

const timeFormats = new Map<string, Intl.DateTimeFormat | null>();
const partFormats = new Map<string, Intl.DateTimeFormat | null>();

// A zone's formatter, or null for a zone this browser does not know. Kept per zone: a clock re-renders once a minute.
function formatFor(
  cache: Map<string, Intl.DateTimeFormat | null>,
  zone: string | undefined,
  opts: Intl.DateTimeFormatOptions,
) {
  const key = zone ?? '';
  if (!cache.has(key)) {
    try {
      cache.set(
        key,
        new Intl.DateTimeFormat(undefined, { ...opts, ...(zone ? { timeZone: zone } : {}) }),
      );
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key) ?? null;
}

/** A zone's wall time at `at`: hours and minutes for the hands, the time as the viewer's locale writes it, and the
 *  day against the viewer's own. Null for a zone the browser does not know. */
export function zoneTime(
  zone: string | undefined,
  at: number,
): { hour: number; minute: number; text: string; dayShift: number } | null {
  const parts = formatFor(partFormats, zone, {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hourCycle: 'h23',
  });
  const text = formatFor(timeFormats, zone, { hour: 'numeric', minute: '2-digit' });
  if (!parts || !text) return null;
  const get = (p: Intl.DateTimeFormatPart[], type: string) =>
    Number(p.find((x) => x.type === type)?.value ?? 0);
  const there = parts.formatToParts(at);
  const here = formatFor(partFormats, undefined, {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hourCycle: 'h23',
  })!.formatToParts(at);
  const dayOf = (p: Intl.DateTimeFormatPart[]) =>
    Date.UTC(get(p, 'year'), get(p, 'month') - 1, get(p, 'day'));
  return {
    hour: get(there, 'hour') % 24,
    minute: get(there, 'minute'),
    text: text.format(at),
    dayShift: Math.round((dayOf(there) - dayOf(here)) / 86_400_000),
  };
}

const LOCAL_ZONE: ClockZone[] = [{ zone: '', label: 'Local' }];

function WorldClockFace({ element }: { element: ShapeElement }) {
  const now = useMinuteNow();
  const zones = (element.clockZones?.length ? element.clockZones : LOCAL_ZONE).slice(
    0,
    CLOCK_DIALS_ON_FACE,
  );
  const art = OFFICE_ART['world-clock'].front;
  const { x, w } = CLOCK_FACE;
  const step = w / zones.length;
  const r = 13;
  return (
    <Overlay element={element}>
      <svg
        viewBox={`0 0 ${art.width} ${art.height}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={zones
          .map((z) => `${z.label}: ${zoneTime(z.zone || undefined, now)?.text ?? 'unknown'}`)
          .join(', ')}
      >
        {zones.map((z, i) => {
          const cx = x + step * (i + 0.5);
          const cy = 32;
          const t = now ? zoneTime(z.zone || undefined, now) : null;
          const minuteA = t ? t.minute * 6 : 0;
          const hourA = t ? (t.hour % 12) * 30 + t.minute * 0.5 : 0;
          return (
            <g key={`${z.zone}-${i}`}>
              <circle cx={cx} cy={cy} r={r + 1.5} fill="#fde68a" />
              <circle cx={cx} cy={cy} r={r} fill="#fffbeb" stroke="#78350f" strokeWidth={1.2} />
              {Array.from({ length: 12 }, (_, k) => {
                const a = (k * Math.PI) / 6;
                const inner = k % 3 === 0 ? r - 3.4 : r - 2.2;
                return (
                  <line
                    key={k}
                    x1={cx + Math.sin(a) * inner}
                    y1={cy - Math.cos(a) * inner}
                    x2={cx + Math.sin(a) * (r - 1)}
                    y2={cy - Math.cos(a) * (r - 1)}
                    stroke="#78350f"
                    strokeWidth={k % 3 === 0 ? 1.1 : 0.6}
                    strokeLinecap="round"
                  />
                );
              })}
              {t ? (
                <>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={cx}
                    y2={cy - r * 0.52}
                    stroke="#1f2937"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    transform={`rotate(${hourA} ${cx} ${cy})`}
                  />
                  <line
                    x1={cx}
                    y1={cy}
                    x2={cx}
                    y2={cy - r * 0.8}
                    stroke="#1f2937"
                    strokeWidth={1.1}
                    strokeLinecap="round"
                    transform={`rotate(${minuteA} ${cx} ${cy})`}
                  />
                </>
              ) : null}
              <circle cx={cx} cy={cy} r={1.4} fill="#b45309" />
              <text
                x={cx}
                y={55}
                textAnchor="middle"
                fontSize={7.5}
                fontWeight={700}
                fill="#fef3c7"
              >
                {clip(z.label || 'Local', 12)}
              </text>
              <text
                x={cx}
                y={66.5}
                textAnchor="middle"
                fontSize={6.5}
                fontWeight={600}
                fill="#fde68a"
              >
                {now ? (t ? t.text : '?') : ''}
                {t && t.dayShift !== 0 ? ` ${t.dayShift > 0 ? '+' : ''}${t.dayShift}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </Overlay>
  );
}

// --- Jukebox --------------------------------------------------------------------------------------------------

function JukeboxFace({ element }: { element: ShapeElement }) {
  const listening = useJukeboxListening();
  const source = element.jukeboxSource;
  const failed = useJukeboxFailed(source);
  if (!source)
    return (
      <Overlay element={element}>
        <span className={`${PILL} pointer-events-none top-[calc(100%+3px)] cursor-default`}>
          No Music Set
        </span>
      </Overlay>
    );
  const label = failed
    ? "Can't Play"
    : listening === 'off'
      ? 'Play'
      : listening === 'on'
        ? 'Mute'
        : 'Unmute';
  return (
    <Overlay element={element}>
      <Tooltip label={label}>
        <button
          type="button"
          className={`${PILL} top-[calc(100%+3px)]`}
          aria-pressed={listening === 'on'}
          {...pieceControlProps}
          onClick={(e) => {
            e.stopPropagation();
            // Applied inside this press: the gesture a browser needs before it lets a page play sound.
            toggleJukeboxListening();
          }}
        >
          <span aria-hidden>{listening === 'on' && !failed ? '♪' : '▶'}</span>
          {label}
        </button>
      </Tooltip>
    </Overlay>
  );
}

// --- Arcade Machine --------------------------------------------------------------------------------------------

function ArcadeBubble({ id }: { id: string }) {
  const near = useNearArcade(id);
  if (!near) return null;
  return (
    <span
      className="lh-coin-bubble pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 whitespace-nowrap rounded-xl border-2 border-slate-800 bg-white px-2 py-1 text-[10px] font-bold text-slate-800 shadow-md dark:border-slate-200 dark:bg-slate-900 dark:text-slate-100"
      style={{ transform: 'translateX(-50%)' }}
      role="status"
    >
      Insert Coin
    </span>
  );
}
