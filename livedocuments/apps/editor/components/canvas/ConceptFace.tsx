import type { CSSProperties, ReactNode } from 'react';
import {
  ANIMATION_SPEED_FACTOR,
  CONCEPT_LABEL_MAX,
  CONCEPT_NOTE_MAX,
  CONCEPT_ROWS,
  DEFAULT_ANIMATION_SPEED,
  arrowheadPoints,
  chevronLayout,
  conceptAnimOf,
  conceptAnimRepeats,
  conceptDrawsNotes,
  conceptFitPx,
  conceptDiscInk,
  conceptRamp,
  cycleLayout,
  hubDrawsSpokes,
  hubLayout,
  layerStackLayout,
  onionLayout,
  pyramidLayout,
  pyramidVariantOf,
  type ConceptRow,
  type ConceptShape,
  type LayoutRect,
  type ShapeElement,
  type WebRows,
} from '@livedocuments/document';
import { InlineTextLine } from '@/components/canvas/InlineTextLine';
import { LabelRegion } from '@/components/canvas/web/LabelRegion';
import { rectStyle } from '@/components/canvas/web/web-face-props';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { ChevronStageControls } from '@/components/canvas/ConceptRowBar';
import { ConceptRowLayer } from './concept-row-layer';
import { ConceptTimelineBody } from './ConceptTimelineBody';
import { useConceptTourPreview } from '@liveworkspace/workbench/lib/concept-tour-preview';

type Props = {
  element: ShapeElement & { shape: ConceptShape };
  labelNode: ReactNode;
  accent: string;
  fill: string;
  ink: string;
  fontFamily: string | undefined;
  editable: boolean;
  onSetRows: (rows: WebRows) => void;
};

const Row = ConceptRowLayer;

// The concept graphics (docs/specs/009-elements/concept-graphics.md): a layer stack, a pyramid (or inverted, or a
// funnel), a cycle, a hub and spoke, onion rings and a chevron process, each row placed by the shared pure layout (the export's numbers) in the accent ramp. Rows
// edit in place once the element is selected; a cycle's centre words are its ordinary label.
export function ConceptFace({
  element,
  labelNode,
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
  const ramp = conceptRamp(n, accent, fill);
  // A cycle's later stages and a hub's satellites sit on discs in the fill, not on the canvas.
  const discInk = conceptDiscInk(ink, fill);
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
      // Where an element tour points (components/tour/concept-element-tour-steps.ts).
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
  const svg = (child: ReactNode) => (
    <svg aria-hidden className="absolute inset-0 overflow-visible" width={W} height={H}>
      {child}
    </svg>
  );

  let body: ReactNode;
  if (element.shape === 'layer-stack') {
    const l = layerStackLayout(
      W,
      H,
      n,
      rows.some((r) => !!r.note),
    );
    body = rows.map((row, i) => {
      const b = l.bands[i]!;
      const note = l.notes[i];
      const rule = l.rules[i];
      return (
        <Row key={i} i={i} origin={{ x: b.x + b.width / 2, y: b.y + b.height / 2 }}>
          {svg(
            <>
              <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={8} fill={ramp[i]!.fill} />
              {rule ? (
                <line
                  x1={rule.x1}
                  x2={rule.x2}
                  y1={rule.y}
                  y2={rule.y}
                  stroke={ink}
                  strokeOpacity={0.35}
                />
              ) : null}
            </>,
          )}
          {line(
            i,
            { ...b, x: b.x + 10, width: Math.max(0, b.width - 20) },
            row.label,
            l.labelPx,
            ramp[i]!.text,
            {
              align: 'left',
            },
          )}
          {note
            ? line(i, note, row.note ?? '', l.notePx, ink, {
                note: true,
                align: 'left',
                bold: false,
              })
            : null}
        </Row>
      );
    });
  } else if (element.shape === 'pyramid') {
    const variant = pyramidVariantOf(element);
    const l = pyramidLayout(W, H, n, variant);
    const notes = conceptDrawsNotes(element);
    body = rows.map((row, i) => {
      const t = l.tiers[i]!;
      // The base builds first on a pyramid; a funnel and an inverted pyramid read top down.
      const order = variant === 'pyramid' ? n - 1 - i : i;
      // A funnel tier with a value splits its width with it; one without takes the whole tier.
      const valued = notes && !!row.note;
      const half = valued ? { ...t.label, width: t.label.width / 2 } : t.label;
      return (
        <Row
          key={i}
          i={order}
          origin={{ x: t.label.x + t.label.width / 2, y: t.label.y + t.label.height / 2 }}
        >
          {svg(
            <polygon
              points={t.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={ramp[i]!.fill}
              strokeLinejoin="round"
            />,
          )}
          {line(i, half, row.label, l.labelPx, ramp[i]!.text, {})}
          {valued
            ? line(
                i,
                { ...t.label, x: t.label.x + t.label.width / 2, width: t.label.width / 2 },
                row.note ?? '',
                l.labelPx,
                ramp[i]!.text,
                { note: true },
              )
            : null}
        </Row>
      );
    });
  } else if (element.shape === 'hub') {
    // The hub builds first, then each satellite clockwise with its spoke.
    const l = hubLayout(W, H, n);
    const spokes = hubDrawsSpokes(element);
    body = (
      <>
        <Row i={0} origin={l.centre}>
          {svg(<circle cx={l.centre.x} cy={l.centre.y} r={l.hubR} fill={accent} />)}
          <LabelRegion rect={l.hubLabel} tourId="concept-centre">
            <div className="absolute inset-0" style={{ color: ramp[0]?.text ?? ink }}>
              {labelNode}
            </div>
          </LabelRegion>
        </Row>
        {rows.map((row, i) => {
          const d = l.satellites[i]!;
          const sp = l.spokes[i]!;
          const rect = {
            x: d.x - l.satR + 2,
            y: d.y - l.satR,
            width: Math.max(0, l.satR * 2 - 4),
            height: l.satR * 2,
          };
          return (
            <Row key={i} i={i + 1} origin={d}>
              {svg(
                <>
                  {spokes ? (
                    <line
                      x1={sp.x1}
                      y1={sp.y1}
                      x2={sp.x2}
                      y2={sp.y2}
                      stroke={accent}
                      strokeOpacity={0.5}
                      strokeWidth={2}
                    />
                  ) : null}
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={l.satR}
                    fill={fill}
                    stroke={accent}
                    strokeWidth={2}
                  />
                </>,
              )}
              {line(i, rect, row.label, l.labelPx, discInk, {})}
            </Row>
          );
        })}
      </>
    );
  } else if (element.shape === 'onion') {
    // Outermost ring first in paint order, so each smaller one sits on top; it builds from the core outward.
    const l = onionLayout(W, H, n);
    const order = rows.map((_, k) => k).reverse();
    body = order.map((k) => (
      <Row key={k} i={k} origin={l.centre}>
        {svg(<circle cx={l.centre.x} cy={l.centre.y} r={l.radii[k]} fill={ramp[k]!.fill} />)}
        {line(k, l.labels[k]!, rows[k]!.label, l.labelPx, ramp[k]!.text, {})}
      </Row>
    ));
  } else if (element.shape === 'timeline-rail') {
    body = (
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
  } else if (element.shape === 'chevrons') {
    const hasNotes = rows.some((r) => !!r.note);
    const l = chevronLayout(W, H, n, hasNotes);
    const stages = rows.map((row, i) => {
      const st = l.stages[i]!;
      return (
        <Row
          key={i}
          i={i}
          origin={{ x: st.label.x + st.label.width / 2, y: st.label.y + st.label.height / 2 }}
        >
          {svg(
            <polygon
              points={st.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={ramp[i]!.fill}
              strokeLinejoin="round"
            />,
          )}
          {line(i, st.label, row.label, l.labelPx, ramp[i]!.text, {})}
          {st.note
            ? line(i, st.note, row.note ?? '', l.notePx, ink, { note: true, bold: false })
            : null}
        </Row>
      );
    });
    body = editable ? (
      <ChevronStageControls
        stages={l.stages}
        labelPx={l.labelPx}
        rows={rows}
        notes={hasNotes}
        invScale={1 / zoom}
        onSetRows={onSetRows}
        tourBar={preview?.bar}
      >
        {stages}
      </ChevronStageControls>
    ) : (
      stages
    );
  } else {
    const l = cycleLayout(W, H, n);
    const head = Math.min(10, Math.max(6, l.discR * 0.14));
    body = (
      <>
        {l.arcs.map((a, i) => (
          <Row key={`arc-${i}`} i={i + 0.5} origin={a.end}>
            {svg(
              <>
                <path
                  className="lvd-cg-arc"
                  d={a.d}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <polygon points={arrowheadPoints(a.end, a.angle, head)} fill={accent} />
              </>,
            )}
          </Row>
        ))}
        {rows.map((row, i) => {
          const d = l.discs[i]!;
          const first = i === 0;
          const rect = {
            x: d.x - l.discR + 4,
            y: d.y - l.discR,
            width: Math.max(0, l.discR * 2 - 8),
            height: l.discR * 2,
          };
          return (
            <Row key={i} i={i} origin={d}>
              {svg(
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={l.discR}
                  fill={first ? accent : fill}
                  stroke={first ? undefined : accent}
                  strokeWidth={first ? undefined : 2}
                />,
              )}
              {line(i, rect, row.label, l.labelPx, first ? ramp[0]!.text : discInk, {})}
            </Row>
          );
        })}
        <LabelRegion rect={l.centreLabel} tourId="concept-centre">
          {labelNode}
        </LabelRegion>
      </>
    );
  }
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
