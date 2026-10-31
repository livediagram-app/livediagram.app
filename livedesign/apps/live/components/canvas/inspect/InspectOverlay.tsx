'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { inspectNumber, type Element as DesignElement, type LaidOutPage } from '@livedesign/design';
import { useCanvasViewKey } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { useCanvasClientOrigin } from '@liveworkspace/workbench/hooks/canvas/useCanvasClientOrigin';
import { useSelectionOf } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import {
  inspectCanvasLines,
  inspectTarget,
  type InspectLine,
  type InspectTarget,
} from '@/lib/inspect-target';

// The measurement ink: a red that reads on white, grey and dark screens alike, apart from the brand-coloured
// selection so a line is never mistaken for an outline.
export const INSPECT_LINE_COLOUR = '#e5484d';
const PILL_TEXT = '#ffffff';
// The pill's size: an 11px label, measured as ~6.4px a character (tabular digits) plus its padding.
const PILL_H = 18;
const pillWidth = (text: string) => Math.ceil(text.length * 6.4 + 12);

const selectedId = (s: Selection) => (s.multiSelectedIds.size > 0 ? null : s.selectedId);

/** The element id under the pointer while it is over the canvas's content, tracked off the content layer's own
 *  pointer events: set only when it changes, so a sample over the same element renders nothing. */
export function useHoveredElementId(wrapperRef: RefObject<HTMLElement | null>): string | null {
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onMove = (e: PointerEvent) => {
      const node = e.target instanceof Element ? e.target.closest('[data-element-id]') : null;
      setHovered(node && wrapper.contains(node) ? node.getAttribute('data-element-id') : null);
    };
    const onLeave = () => setHovered(null);
    wrapper.addEventListener('pointermove', onMove, { passive: true });
    wrapper.addEventListener('pointerleave', onLeave);
    return () => {
      wrapper.removeEventListener('pointermove', onMove);
      wrapper.removeEventListener('pointerleave', onLeave);
    };
  }, [wrapperRef]);
  return hovered;
}

// Inspect's measurements on the canvas (docs/specs/007-editor/wireframe-pages.md "The measurements on the canvas"):
// the hovered element's outline, the selected element's outline and size, and the measured lines with their
// distances. Chrome in fixed client coordinates over the canvas (as CanvasGuideOverlay), the same at every zoom;
// mounted only while Inspect is on.
export function InspectOverlay({
  elements,
  pages,
  wrapperRef,
  mainSize,
}: {
  elements: readonly DesignElement[];
  pages: readonly LaidOutPage[];
  wrapperRef: RefObject<HTMLDivElement | null>;
  mainSize: { width: number; height: number };
}) {
  const hoveredId = useHoveredElementId(wrapperRef);
  const selId = useSelectionOf(selectedId);
  const selected = useMemo(() => inspectTarget(selId, elements, pages), [selId, elements, pages]);
  const hovered = useMemo(
    () => inspectTarget(hoveredId, elements, pages),
    [hoveredId, elements, pages],
  );
  const lines = useMemo(
    () => inspectCanvasLines(selected, hovered, elements, pages),
    [selected, hovered, elements, pages],
  );
  const { viewportZoom: zoom, viewKey } = useCanvasViewKey(mainSize);
  const origin = useCanvasClientOrigin(wrapperRef, !!(selected || hovered), viewKey);
  if (!origin || !(selected || hovered)) return null;
  const sx = (v: number) => origin.left + v * zoom;
  const sy = (v: number) => origin.top + v * zoom;
  const box = (t: InspectTarget) => ({
    x: sx(t.rect.x),
    y: sy(t.rect.y),
    w: t.rect.width * zoom,
    h: t.rect.height * zoom,
  });
  const hoverOnly = hovered && hovered.el.id !== selected?.el.id ? hovered : null;
  return (
    <svg
      aria-hidden
      data-inspect-overlay=""
      // Beneath the panels (the Inspect panel among them), so a measurement never draws over the values it reads.
      className="pointer-events-none fixed inset-0 z-[calc(var(--z-panel)-1)] h-screen w-screen"
    >
      {lines.map((l) =>
        l.toElement && l.toElement.id !== hoverOnly?.el.id ? (
          <TargetOutline key={`to-${l.side}`} t={l.toElement} sx={sx} sy={sy} zoom={zoom} />
        ) : null,
      )}
      {hoverOnly ? (
        <rect
          {...rectAttrs(box(hoverOnly))}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={1.5}
        />
      ) : null}
      {selected ? (
        <SelectedOutline b={box(selected)} target={selected} measured={sidesOf(lines)} />
      ) : null}
      {lines.map((l) => (
        <MeasureLine key={`${l.side}-${l.axis}`} line={l} sx={sx} sy={sy} />
      ))}
    </svg>
  );
}

const rectAttrs = (b: { x: number; y: number; w: number; h: number }) => ({
  x: b.x,
  y: b.y,
  width: Math.max(0, b.w),
  height: Math.max(0, b.h),
});

function TargetOutline({
  t,
  sx,
  sy,
  zoom,
}: {
  t: { x: number; y: number; width: number; height: number };
  sx: (v: number) => number;
  sy: (v: number) => number;
  zoom: number;
}) {
  return (
    <rect
      x={sx(t.x)}
      y={sy(t.y)}
      width={t.width * zoom}
      height={t.height * zoom}
      fill="none"
      stroke={INSPECT_LINE_COLOUR}
      strokeWidth={1}
      strokeDasharray="3 3"
      strokeOpacity={0.8}
    />
  );
}

const sidesOf = (lines: readonly InspectLine[]): ReadonlySet<string> =>
  new Set(lines.map((l) => l.side));

/** Where the size pill sits clear of the measured lines: centred below the element, else centred above it when a
 *  line runs down from it, else outside its bottom-right corner when lines run both ways. */
export function sizePillAt(
  b: { x: number; y: number; w: number; h: number },
  w: number,
  measured: ReadonlySet<string>,
): { x: number; y: number } {
  if (!measured.has('bottom')) return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h + 6 };
  if (!measured.has('top')) return { x: b.x + b.w / 2 - w / 2, y: b.y - 6 - PILL_H };
  return { x: b.x + b.w + 6, y: b.y + b.h + 6 };
}

function SelectedOutline({
  b,
  target,
  measured,
}: {
  b: { x: number; y: number; w: number; h: number };
  target: InspectTarget;
  measured: ReadonlySet<string>;
}) {
  const label = `${inspectNumber(target.rect.width)} × ${inspectNumber(target.rect.height)}`;
  const w = pillWidth(label);
  const at = sizePillAt(b, w, measured);
  return (
    <g>
      <rect {...rectAttrs(b)} fill="none" stroke="var(--color-brand-500)" strokeWidth={2} />
      <g transform={`translate(${at.x}, ${at.y})`} data-inspect-size="">
        <rect width={w} height={PILL_H} rx={4} fill="var(--color-brand-600)" />
        <text
          x={w / 2}
          y={PILL_H / 2}
          dy="0.35em"
          textAnchor="middle"
          fill={PILL_TEXT}
          fontSize={11}
          fontWeight={600}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

function MeasureLine({
  line,
  sx,
  sy,
}: {
  line: InspectLine;
  sx: (v: number) => number;
  sy: (v: number) => number;
}) {
  const label = String(inspectNumber(line.distance));
  const w = pillWidth(label);
  const across = line.axis === 'x';
  const x1 = across ? sx(line.from) : sx(line.cross);
  const x2 = across ? sx(line.to) : sx(line.cross);
  const y1 = across ? sy(line.cross) : sy(line.from);
  const y2 = across ? sy(line.cross) : sy(line.to);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const tick = 4;
  return (
    <g data-inspect-line={line.side}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INSPECT_LINE_COLOUR} strokeWidth={1} />
      {across ? (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} stroke={INSPECT_LINE_COLOUR} />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} stroke={INSPECT_LINE_COLOUR} />
        </>
      ) : (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} stroke={INSPECT_LINE_COLOUR} />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} stroke={INSPECT_LINE_COLOUR} />
        </>
      )}
      <g transform={`translate(${mx - w / 2}, ${my - PILL_H / 2})`}>
        <rect width={w} height={PILL_H} rx={4} fill={INSPECT_LINE_COLOUR} />
        <text
          x={w / 2}
          y={PILL_H / 2}
          dy="0.35em"
          textAnchor="middle"
          fill={PILL_TEXT}
          fontSize={11}
          fontWeight={600}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {label}
        </text>
      </g>
    </g>
  );
}
