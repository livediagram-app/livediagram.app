import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Glyph, Tooltip } from '@livediagram/ui';
import {
  CONCEPT_ROWS,
  type ChevronLayout,
  type ConceptRow,
  type LayoutRect,
  type WebRows,
} from '@livediagram/document';
import { FLOATING_CONTROL_CLASS } from '@/components/chrome/floating-controls';
import { rectStyle } from '@/components/canvas/web/web-face-props';
import { useGraceHover } from '@/hooks/ui/useGraceHover';
import { isMobileViewportSync } from '@/lib/responsive';
import { moveRow } from '@/lib/move-row';

// A chevron stage's own controls (docs/specs/009-elements/concept-graphics.md "Editing"): move it left, move it
// right, delete it, and give it a note while no stage has one. Drawn inside the top of the stage it acts on, at a constant screen size, while that stage
// is hovered (every stage at once on a phone, which has no hover). A press on the bar never reaches the element, so it
// neither drags nor deselects it.

// The bar's top, in screen px, below the stage's top edge.
const BAR_INSET_PX = 6;

const button =
  'flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-500 transition enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-default disabled:opacity-30 dark:text-slate-300 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-brand-100';

const stop = (e: ReactPointerEvent) => e.stopPropagation();

export function ConceptRowBar({
  rect,
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
  // The stage's box in element px; the bar centres on it.
  rect: LayoutRect;
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
        top: rect.y + BAR_INSET_PX * invScale,
        transform: `translateX(-50%) scale(${invScale})`,
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
  const xs = stage.points.map((p) => p.x);
  const ys = stage.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * A selected, editable chevron process's stages (`children`) between their hover zones and their bars. Each zone sits
 * under the stages, so the words stay editable and a press still reaches the element; the bars sit over them. Leaving
 * a zone clears the hover after a grace, so the pointer can reach the bar. On a phone (no hover) every bar shows.
 */
export function ChevronStageControls({
  stages,
  rows,
  notes,
  invScale,
  onSetRows,
  children,
}: {
  stages: ChevronLayout['stages'];
  rows: ConceptRow[];
  // Whether any stage has a note (so the note line is drawn); Add Note is offered while none does.
  notes: boolean;
  invScale: number;
  onSetRows: (rows: WebRows) => void;
  children: ReactNode;
}) {
  const hover = useGraceHover<number>();
  const all = isMobileViewportSync();
  const { min, noun } = CONCEPT_ROWS.chevrons;
  const n = rows.length;
  return (
    <>
      {rows.map((_, i) => (
        <div
          key={i}
          data-concept-row-zone={i}
          className="absolute"
          style={rectStyle(boxOf(stages[i]!))}
          onPointerEnter={() => hover.enter(i)}
          onPointerLeave={hover.leave}
        />
      ))}
      {children}
      {rows.map((_, i) =>
        all || hover.hovered === i ? (
          <ConceptRowBar
            key={i}
            rect={{ ...stages[i]!.label, y: boxOf(stages[i]!).y }}
            index={i}
            count={n}
            min={min}
            noun={noun}
            invScale={invScale}
            onPointerEnter={() => hover.enter(i)}
            onPointerLeave={hover.leave}
            onMove={(to) => {
              hover.set(all ? null : to);
              onSetRows({ conceptRows: moveRow(rows, i, to) });
            }}
            onRemove={() => {
              hover.set(null);
              onSetRows({ conceptRows: rows.filter((_, j) => j !== i) });
            }}
            onAddNote={
              notes
                ? undefined
                : () =>
                    onSetRows({
                      conceptRows: rows.map((r, j) => (j === i ? { ...r, note: 'Note' } : r)),
                    })
            }
          />
        ) : null,
      )}
    </>
  );
}
