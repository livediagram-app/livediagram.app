import type { ReactNode } from 'react';
import {
  BORDER_DASH_ARRAY,
  KEY_EMPTY_HINT,
  KEY_MEANING_MAX,
  diagramKeyLayout,
  meaningOf,
  type BorderStyle,
  type ShapeElement,
  type WebRows,
} from '@livepages/document';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle } from '@/components/canvas/web/web-face-props';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';

// The diagram key (docs/specs/009-elements/diagram-key.md): its title (the element's ordinary label) and each stored
// row, a swatch beside the row's meaning, placed by the export's `diagramKeyLayout`. A meaning edits in place once the
// key is selected; an empty one falls back to the row's starting words.
export function DiagramKeyFace({
  element,
  labelNode,
  accent,
  paper,
  ink,
  fontFamily,
  editable,
  onSetRows,
}: {
  element: ShapeElement;
  labelNode: ReactNode;
  accent: string;
  // The key's own fill, which a tag row's card swatch is drawn on, so it reads as a card on any theme.
  paper: string;
  ink: string;
  fontFamily: string | undefined;
  editable: boolean;
  onSetRows: (rows: WebRows) => void;
}) {
  const zoom = useCanvasZoom();
  const rows = element.keyRows ?? [];
  const l = diagramKeyLayout(element.width, rows.length);
  return (
    <>
      <LabelRegion rect={l.title}>
        <div className="absolute inset-0" style={{ color: ink }}>
          {labelNode}
        </div>
      </LabelRegion>
      {rows.length === 0 ? (
        <div
          className="absolute flex items-center text-[11px]"
          style={{ ...rectStyle(l.rows[0]!.meaning), color: ink, opacity: 0.55, fontFamily }}
        >
          {KEY_EMPTY_HINT}
        </div>
      ) : null}
      {rows.map((row, i) => {
        const { swatch: s, meaning } = l.rows[i]!;
        const dash =
          row.kind === 'line' ? BORDER_DASH_ARRAY[(row.style ?? 'solid') as BorderStyle] : null;
        return (
          <div key={row.id} data-key-row={row.id}>
            <svg
              aria-hidden
              className="pointer-events-none absolute overflow-visible"
              style={rectStyle(s)}
              width={s.width}
              height={s.height}
            >
              {row.kind === 'line' ? (
                <>
                  <line
                    x1={0}
                    y1={s.height / 2}
                    x2={s.width - 6}
                    y2={s.height / 2}
                    stroke={ink}
                    strokeWidth={1.5}
                    strokeDasharray={dash ?? undefined}
                  />
                  <polygon
                    points={`${s.width},${s.height / 2} ${s.width - 7},${s.height / 2 - 4} ${s.width - 7},${s.height / 2 + 4}`}
                    fill={ink}
                  />
                </>
              ) : (
                <>
                  <rect
                    width={s.width}
                    height={s.height}
                    rx={3}
                    fill={paper}
                    stroke={accent}
                    strokeOpacity={0.4}
                  />
                  <rect width={4} height={s.height} fill={row.color ?? accent} />
                </>
              )}
            </svg>
            <div
              // Its row's meaning, named for the Diagram Key tour to ring (the row's wrapper has no box of its own).
              data-key-meaning={row.id}
              className="absolute flex items-center"
              style={{ ...rectStyle(meaning), fontFamily }}
            >
              <InlineTextLine
                value={meaningOf(element, row)}
                placeholder="Meaning"
                editable={editable}
                onCommit={(v) => onSetRows({ keyMeaning: { rowId: row.id, text: v } })}
                zoom={zoom}
                maxLength={KEY_MEANING_MAX}
                className="truncate leading-snug"
                style={{ color: ink, fontSize: 12 }}
                ariaLabel={`${meaningOf({ ...element, keyMeanings: {} }, row)} meaning`}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
