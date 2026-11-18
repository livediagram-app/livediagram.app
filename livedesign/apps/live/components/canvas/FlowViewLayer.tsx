'use client';

// The Flow view (docs/specs/007-editor/wireframe-pages.md "Flow view"): an arrow from each linked element to the
// screen it goes to, a Back tag on a back link, a dashed stub and a Broken tag on a broken one. Canvas chrome in canvas
// coords, drawn after the elements, its strokes and tags held in screen px; it takes no presses and is never exported.
import { memo, useId, useMemo } from 'react';
import type { Element, LaidOutPage, Layer } from '@livedesign/design';
import {
  FLOW_TAG_GLYPH_PX,
  FLOW_TAG_LABEL,
  flowLinks,
  type FlowLink,
  type FlowRect,
} from '@/lib/flow-view';
import { BackLinkGlyph, BrokenScreenLinkGlyph } from './screen-link-glyphs';

// The arrows' stroke and the canvas-coloured edge under it (screen px).
export const FLOW_STROKE_PX = 2;
export const FLOW_HALO_PX = 6;

const BRAND = 'stroke-brand-500';
const BROKEN = 'stroke-rose-600 dark:stroke-rose-400';
const HALO = 'stroke-white dark:stroke-slate-900';

function BoxOutline({ box, broken, zoom }: { box: FlowRect; broken: boolean; zoom: number }) {
  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      rx={4 / zoom}
      className={broken ? `fill-rose-500/10 ${BROKEN}` : `fill-brand-500/10 ${BRAND}`}
      strokeWidth={FLOW_STROKE_PX / zoom}
      // Dashed as well as red: the brand is a red too, so a broken box never says so by colour alone.
      strokeDasharray={broken ? `${4 / zoom} ${3 / zoom}` : undefined}
    />
  );
}

function Tag({
  at,
  side,
  zoom,
  kind,
}: {
  at: { x: number; y: number };
  // Which way it runs from `at`: right, or left (where the right would cover an arrow).
  side: 1 | -1;
  zoom: number;
  kind: 'back' | 'broken';
}) {
  return (
    <div
      data-flow-tag={kind}
      data-flow-tag-side={side > 0 ? 'right' : 'left'}
      className="pointer-events-none absolute"
      style={{
        left: at.x,
        top: at.y,
        transform: `scale(${1 / zoom})`,
        transformOrigin: '0 0',
      }}
    >
      <div
        className={`flex -translate-y-1/2 ${side > 0 ? '' : '-translate-x-full'} items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm ring-1 ${
          kind === 'broken'
            ? 'bg-white text-rose-700 ring-rose-300 dark:bg-slate-900 dark:text-rose-300 dark:ring-rose-500/50'
            : 'bg-white text-brand-700 ring-brand-200 dark:bg-slate-900 dark:text-brand-200 dark:ring-brand-500/40'
        }`}
      >
        {kind === 'broken' ? (
          <BrokenScreenLinkGlyph size={FLOW_TAG_GLYPH_PX} />
        ) : (
          <BackLinkGlyph size={FLOW_TAG_GLYPH_PX} />
        )}
        {FLOW_TAG_LABEL[kind]}
      </div>
    </div>
  );
}

function FlowArrow({
  link,
  zoom,
  head,
}: {
  link: Extract<FlowLink, { state: 'page' }>;
  zoom: number;
  head: string;
}) {
  return (
    <g data-flow-arrow={link.toPageId}>
      <path
        d={link.path}
        fill="none"
        className={HALO}
        strokeOpacity={0.85}
        strokeWidth={FLOW_HALO_PX / zoom}
        strokeLinecap="round"
      />
      <path
        d={link.path}
        fill="none"
        className={BRAND}
        strokeWidth={FLOW_STROKE_PX / zoom}
        strokeLinecap="round"
        markerEnd={`url(#${head})`}
      />
      <circle
        cx={link.start.x}
        cy={link.start.y}
        r={3.5 / zoom}
        className={`fill-brand-500 ${HALO}`}
        strokeWidth={1.5 / zoom}
      />
    </g>
  );
}

export const FlowViewLayer = memo(function FlowViewLayer({
  elements,
  layers,
  pages,
  zoom,
}: {
  elements: Element[];
  layers: Layer[] | undefined;
  pages: readonly LaidOutPage[];
  zoom: number;
}) {
  const head = `flow-head-${useId().replace(/:/g, '')}`;
  const links = useMemo(
    () => flowLinks(elements, layers, pages, zoom),
    [elements, layers, pages, zoom],
  );
  if (links.length === 0) return null;
  return (
    <>
      <svg
        aria-hidden
        data-flow-view=""
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-visible"
      >
        <defs>
          {/* In stroke widths, so the head holds its size at every zoom as the stroke does. */}
          <marker
            id={head}
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={5}
            markerHeight={5}
            markerUnits="strokeWidth"
            orient="auto"
          >
            <path d="M1 1 L9 5 L1 9 Z" className="fill-brand-500" />
          </marker>
        </defs>
        {links.map((link) => (
          <g key={link.elementId}>
            <BoxOutline box={link.box} broken={link.state === 'broken'} zoom={zoom} />
            {link.state === 'page' ? <FlowArrow link={link} zoom={zoom} head={head} /> : null}
            {link.state === 'broken' ? (
              <line
                x1={link.stub.from.x}
                y1={link.stub.from.y}
                x2={link.stub.to.x}
                y2={link.stub.to.y}
                className={BROKEN}
                strokeWidth={FLOW_STROKE_PX / zoom}
                strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                strokeLinecap="round"
              />
            ) : null}
          </g>
        ))}
      </svg>
      {links.map((link) =>
        link.state === 'back' || link.state === 'broken' ? (
          <Tag key={link.elementId} kind={link.state} side={link.side} zoom={zoom} at={link.at} />
        ) : null,
      )}
    </>
  );
});
