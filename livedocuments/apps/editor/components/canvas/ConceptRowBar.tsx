import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Glyph, Tooltip } from '@livedocuments/ui';
import {
  boundsOfPoints,
  type ChevronLayout,
  CONCEPT_ROWS,
  type ConceptRow,
  type LayoutRect,
  type WebRows,
} from '@livedocuments/document';
import { FLOATING_CONTROL_CLASS } from '@liveworkspace/workbench/components/chrome/floating-controls';
import { rectStyle } from '@/components/canvas/web/web-face-props';
import { useCoarsePointer } from '@liveworkspace/workbench/hooks/ui/useCoarsePointer';
import { useGraceHover } from '@liveworkspace/workbench/hooks/ui/useGraceHover';
import { track } from '@/lib/telemetry';
import { isMobileViewportSync } from '@liveworkspace/workbench/lib/responsive';
import { moveRow } from '@liveworkspace/workbench/lib/move-row';

// A chevron stage's own controls (docs/specs/009-elements/concept-graphics.md "Editing"): move it left, move it
// right, delete it, and give it a note while no stage has one. Drawn inside the top of the stage it acts on, at a constant screen size, while that stage
// is hovered (every stage at once on a phone, which has no hover). A press on the bar never reaches the element, so it
// neither drags nor deselects it.

// The bar's top, in screen px, below the stage's top edge.
const BAR_INSET_PX = 6;
// A button's side and the bar's spacing, in screen px, matching the classes below (h-6 w-6, gap-0.5, p-0.5, a 1px
// border), so the bar's width is known without measuring it.
const BUTTON_PX = 24;
const BAR_GAP_PX = 2;
const BAR_EDGE_PX = 3;
// Smallest share of its full size a bar may shrink to so it fits its stage when zoomed out; below it the bar would be
// too small to press, so it is not drawn (zooming in brings it back).
export const BAR_MIN_SCALE = 0.75;
// How far above the middle of its stage a name's letters reach, as a share of its font size (one centred line), with
// a little clearance.
const NAME_HALF_HEIGHT = 0.75;

/** The bar's width in screen px at full size, with `buttons` buttons. */
export function barWidthPx(buttons: number): number {
  return buttons * BUTTON_PX + (buttons - 1) * BAR_GAP_PX + 2 * BAR_EDGE_PX;
}

const BAR_HEIGHT_PX = BUTTON_PX + 2 * BAR_EDGE_PX;

/** The bar's scale in element px: constant on screen, shrunk when zoomed out to fit `room` (the stage's own share of
 *  the row, and the band from its top edge to its name's letters, inset included), or null when that is below
 *  BAR_MIN_SCALE of its size. */
export function barScale(
  room: { width: number; height: number },
  buttons: number,
  invScale: number,
): number | null {
  const fit = Math.min(
    invScale,
    room.width / barWidthPx(buttons),
    room.height / (BAR_HEIGHT_PX + BAR_INSET_PX),
  );
  return fit < BAR_MIN_SCALE * invScale ? null : fit;
}

const button =
  'flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-500 transition enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-default disabled:opacity-30 dark:text-slate-300 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-brand-100';

const stop = (e: ReactPointerEvent) => e.stopPropagation();

export function ConceptRowBar({
  rect,
  room,
  index,
  count,
  min,
  noun,
  invScale,
  onMove,
  onRemove,
  onAddNote,
  onPointerEnter,
  onPointerLeave,
}: {
  // Where the bar centres (the stage's label box, from the stage's top), in element px.
  rect: LayoutRect;
  // The room it may take, in element px: the stage's own share of the row, and the band above its name.
  room: { width: number; height: number };
  index: number;
  count: number;
  // Fewest rows the kind keeps: Delete is off at it.
  min: number;
  noun: string;
  invScale: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  // Gives the stage a note, offered while no stage has one (so no note line is drawn to click into).
  onAddNote?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  const lower = noun.toLowerCase();
  const scale = barScale(room, onAddNote ? 4 : 3, invScale);
  if (scale === null) return null;
  return (
    <div
      role="toolbar"
      aria-label={`${noun} ${index + 1}`}
      data-concept-row-bar=""
      onPointerDown={stop}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`pointer-events-auto absolute flex items-center gap-0.5 p-0.5 ${FLOATING_CONTROL_CLASS}`}
      style={{
        left: rect.x + rect.width / 2,
        top: rect.y + BAR_INSET_PX * scale,
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: 'top center',
      }}
    >
      <Tooltip label={`Move ${noun} Left`}>
        <button
          type="button"
          aria-label={`Move ${lower} left`}
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
          className={button}
        >
          <Glyph size={14} units={18}>
            <path d="M11 4 6 9l5 5" />
          </Glyph>
        </button>
      </Tooltip>
      <Tooltip label={`Move ${noun} Right`}>
        <button
          type="button"
          aria-label={`Move ${lower} right`}
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
          className={button}
        >
          <Glyph size={14} units={18}>
            <path d="m7 4 5 5-5 5" />
          </Glyph>
        </button>
      </Tooltip>
      {onAddNote ? (
        <Tooltip label="Add Note">
          <button type="button" aria-label="Add note" onClick={onAddNote} className={button}>
            <Glyph size={14} units={18}>
              <path d="M4 13.5h6M4 10h10M4 6.5h10M14 12v4M12 14h4" />
            </Glyph>
          </button>
        </Tooltip>
      ) : null}
      <Tooltip label={`Delete ${noun}`}>
        <button
          type="button"
          aria-label={`Delete ${lower}`}
          disabled={count <= min}
          onClick={onRemove}
          className={button}
        >
          <Glyph size={14} units={18}>
            <path d="M3.5 5h11M7.5 5V3.5h3V5M5 5l.8 9.5h6.4L13 5" />
          </Glyph>
        </button>
      </Tooltip>
    </div>
  );
}

// The stage's bounding box, from its outline.
function boxOf(stage: ChevronLayout['stages'][number]): LayoutRect {
  return boundsOfPoints(stage.points)!;
}

/**
 * A selected, editable chevron process's stages (`children`) between their hover zones and their bars. Each zone sits
 * under the stages, so the words stay editable and a press still reaches the element; the bars sit over them. Leaving
 * a zone clears the hover after a grace, so the pointer can reach the bar. On a phone or any touch screen (no hover)
 * every bar shows.
 */
export function ChevronStageControls({
  stages,
  labelPx,
  rows,
  notes,
  invScale,
  onSetRows,
  tourBar,
  children,
}: {
  stages: ChevronLayout['stages'];
  // The stage names' font size, so a bar never covers a name.
  labelPx: number;
  rows: ConceptRow[];
  // Whether any stage has a note (so the note line is drawn); Add Note is offered while none does.
  notes: boolean;
  invScale: number;
  onSetRows: (rows: WebRows) => void;
  // A stage whose bar an element tour step holds open (docs/specs/007-editor/element-tours.md "The Chevrons tour").
  tourBar?: number;
  children: ReactNode;
}) {
  const hover = useGraceHover<number>();
  // Every bar shows where there is no hover to reveal one: a phone, and any touch screen (a tablet is wide).
  const coarse = useCoarsePointer();
  const all = coarse || isMobileViewportSync();
  const zones = useRef<(HTMLDivElement | null)[]>([]);
  // A stage moved, deleted or given a note: the same event the menu's row editor sends (useWebComponentSetters).
  const setRows = (next: WebRows) => {
    onSetRows(next);
    track('Element', 'Changed', 'ConceptRows');
  };
  const overName = (e: ReactPointerEvent) => {
    const at = zones.current.findIndex((z) => {
      const r = z?.getBoundingClientRect();
      return (
        !!r &&
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      );
    });
    // Every move, so a grace begun by leaving the zone is cancelled; the same stage again does not re-render.
    if (at >= 0) hover.enter(at);
  };
  const { min, noun } = CONCEPT_ROWS.chevrons;
  const n = rows.length;
  // Neighbouring chevrons overlap at their points, so a stage's own room is the step from one stage to the next.
  const pitch =
    stages.length > 1 ? boxOf(stages[1]!).x - boxOf(stages[0]!).x : boxOf(stages[0]!).width;
  return (
    <>
      {rows.map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            zones.current[i] = el;
          }}
          data-concept-row-zone={i}
          className="absolute"
          style={rectStyle(boxOf(stages[i]!))}
          onPointerEnter={() => hover.enter(i)}
          onPointerLeave={hover.leave}
        />
      ))}
      {/* The names lie over their zones, so a pointer on a name has left its zone: the stage under it is found from
          the zones' boxes, and leaving the names starts the same grace as leaving a zone. */}
      <div className="contents" onPointerMove={overName} onPointerLeave={hover.leave}>
        {children}
      </div>
      {rows.map((_, i) =>
        all || hover.hovered === i || tourBar === i ? (
          <ConceptRowBar
            key={i}
            rect={{ ...stages[i]!.label, y: boxOf(stages[i]!).y }}
            room={{
              // The bar is centred on the stage's words, which sit inset from its point: its room is the narrower of
              // those and the step to the next stage, so a full bar never runs onto a neighbour.
              width: Math.min(pitch, stages[i]!.label.width),
              height: boxOf(stages[i]!).height / 2 - NAME_HALF_HEIGHT * labelPx,
            }}
            index={i}
            count={n}
            min={min}
            noun={noun}
            invScale={invScale}
            onPointerEnter={() => hover.enter(i)}
            onPointerLeave={hover.leave}
            onMove={(to) => {
              hover.set(all ? null : to);
              setRows({ conceptRows: moveRow(rows, i, to) });
            }}
            onRemove={() => {
              hover.set(null);
              setRows({ conceptRows: rows.filter((_, j) => j !== i) });
            }}
            onAddNote={
              notes
                ? undefined
                : () =>
                    setRows({
                      conceptRows: rows.map((r, j) => (j === i ? { ...r, note: 'Note' } : r)),
                    })
            }
          />
        ) : null,
      )}
    </>
  );
}
