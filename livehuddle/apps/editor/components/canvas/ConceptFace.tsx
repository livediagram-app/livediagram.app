import type { CSSProperties } from 'react';
import {
  ANIMATION_SPEED_FACTOR,
  CONCEPT_LABEL_MAX,
  CONCEPT_NOTE_MAX,
  CONCEPT_ROWS,
  DEFAULT_ANIMATION_SPEED,
  conceptAnimOf,
  conceptAnimRepeats,
  conceptFitPx,
  type ConceptRow,
  type ConceptShape,
  type LayoutRect,
  type ShapeElement,
  type WebRows,
} from '@livehuddle/document';
import { InlineTextLine } from '@liveworkspace/workbench/components/canvas/InlineTextLine';
import { rectStyle } from '@/components/canvas/web/web-face-props';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { ConceptTimelineBody } from './ConceptTimelineBody';
import { useConceptTourPreview } from '@liveworkspace/workbench/lib/concept-tour-preview';

type Props = {
  element: ShapeElement & { shape: ConceptShape };
  accent: string;
  fill: string;
  ink: string;
  fontFamily: string | undefined;
  editable: boolean;
  onSetRows: (rows: WebRows) => void;
};

// The Timeline (docs/specs/009-elements/timeline.md): milestones along a line, each placed by the shared pure layout
// (the export's numbers). Rows edit in place once the element is selected.
export function ConceptFace({
  element,
  accent,
  fill,
  ink,
  fontFamily,
  editable,
  onSetRows,
}: Props) {
  const zoom = useCanvasZoom();
  const rows = element.conceptRows ?? [];
  const n = rows.length;
  const noun = CONCEPT_ROWS[element.shape].noun;
  const write = (i: number, patch: Partial<ConceptRow>) =>
    onSetRows({ conceptRows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  // An element tour previews an animation on the element it is on, played once and never stored
  // (docs/specs/007-editor/element-tours.md); otherwise the element's own.
  const preview = useConceptTourPreview(element.id);
  // A chart's Grow is never previewed on a concept graphic.
  const previewAnim = preview?.anim === 'grow' ? undefined : preview?.anim;
  const anim = previewAnim ?? conceptAnimOf(element);
  // A previewed Build plays once; a previewed loop (Pulse, Flow) keeps going while its step is up.
  const repeats = previewAnim ? previewAnim !== 'build' : conceptAnimRepeats(element);
  const animClass = !anim
    ? ''
    : anim === 'build'
      ? repeats
        ? 'lvd-concept-build-loop'
        : 'lvd-concept-build'
      : `lvd-concept-${anim}`;
  const vars = {
    '--lvd-cg-n': Math.max(1, n),
    '--lvd-concept-speed':
      ANIMATION_SPEED_FACTOR[element.conceptAnimSpeed ?? DEFAULT_ANIMATION_SPEED],
    ...(repeats ? {} : { '--lvd-concept-iter': 1 }),
  } as CSSProperties;
  const line = (
    i: number,
    rect: LayoutRect,
    value: string,
    px: number,
    colour: string,
    // A note is muted (70%) unless asked otherwise: a milestone's when is in the accent at full strength.
    opts: { note?: boolean; align?: 'left' | 'center'; bold?: boolean; muted?: boolean },
  ) => (
    <div
      className={`absolute flex items-center ${opts.align === 'left' ? 'justify-start' : 'justify-center'} px-1`}
      style={{ ...rectStyle(rect), fontFamily }}
      // Where an element tour points (livediagram's element tours; livehuddle tours no concept graphic).
      {...(opts.note ? { 'data-concept-note': i } : { 'data-concept-row': i })}
    >
      <InlineTextLine
        value={value}
        placeholder={opts.note ? (CONCEPT_ROWS[element.shape].noteNoun ?? 'Note') : noun}
        editable={editable}
        onCommit={(v) => write(i, opts.note ? { note: v || undefined } : { label: v })}
        zoom={zoom}
        maxLength={opts.note ? CONCEPT_NOTE_MAX : CONCEPT_LABEL_MAX}
        className={`truncate leading-snug ${opts.bold === false ? '' : 'font-semibold'} ${
          opts.align === 'left' ? 'text-left' : 'text-center'
        }`}
        style={{
          color: colour,
          fontSize: conceptFitPx(value, rect.width, px),
          opacity: opts.note && opts.muted !== false ? 0.7 : 1,
        }}
        ariaLabel={`${noun} ${i + 1}${opts.note ? ` ${(CONCEPT_ROWS[element.shape].noteNoun ?? 'note').toLowerCase()}` : ''}`}
      />
    </div>
  );
  const W = element.width;
  const H = element.height;

  const body = (
    <ConceptTimelineBody
      width={W}
      height={H}
      rows={rows}
      accent={accent}
      fill={fill}
      ink={ink}
      line={line}
    />
  );
  return (
    // A preview's run keys the layer, so pressing a step again replays it from the start.
    <div
      key={preview?.anim ? preview.run : 'own'}
      className={`absolute inset-0 ${animClass}`}
      style={vars}
    >
      {body}
    </div>
  );
}
