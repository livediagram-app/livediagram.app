'use client';

// The zone bar (docs/specs/007-editor/article-pages.md "Zones"): under a zone's bottom edge while the
// zone, or elements all in it, are selected, or under a floating object on an article page. How it
// sits (In line, Wrap left, Wrap right, or Float in front of the text), where an inline one sits across the text, and Delete (the zone and its elements), led by a
// grip that drags the zone to a new place in the writing. Drawn in
// canvas space at one screen size, so it rides the zone through a pan or a zoom.
import type { ReactNode } from 'react';
import {
  lucideBringToFront,
  lucideGripVertical,
  lucidePanelLeft,
  lucidePanelRight,
  lucideRows2,
  lucideTextAlignCenter,
  lucideTextAlignEnd,
  lucideTextAlignStart,
} from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip, TrashIcon } from '@livediagram/ui';
import type { ArticleZoneAlign, ArticleZoneWrap, PageRect } from '@livediagram/document';

const I = (g: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(g, 16);
const Inline = I(lucideRows2);
const WrapLeft = I(lucidePanelLeft);
const WrapRight = I(lucidePanelRight);
const AlignLeft = I(lucideTextAlignStart);
const AlignCenter = I(lucideTextAlignCenter);
const AlignRight = I(lucideTextAlignEnd);
const Grip = I(lucideGripVertical);
const Float = I(lucideBringToFront);

// How a zone (or a floating object) sits: in the writing (in line, or wrapped), or in front of it.
export type ZoneFit = ArticleZoneWrap | 'float';

export function ZoneBar({
  fit,
  align,
  drawing,
  rect,
  zoom,
  onFit,
  onAlign,
  onRemove,
  onMoveStart,
}: {
  fit: ZoneFit;
  align: ArticleZoneAlign;
  // A drawing zone (named so, and its Delete takes its drawing); else an object.
  drawing: boolean;
  rect: PageRect;
  zoom: number;
  onFit: (fit: ZoneFit) => void;
  onAlign: (align: ArticleZoneAlign) => void;
  // Absent for a floating object: its own toolbar deletes it.
  onRemove?: () => void;
  // A press on the grip (a zone in the writing): the zone is dragged through it (useZoneDrag).
  onMoveStart?: (e: React.PointerEvent<HTMLElement>) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label={drawing ? 'Drawing' : 'Object in the text'}
      data-article-keep-active=""
      data-zone-bar=""
      className="pointer-events-auto absolute flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
      style={{
        // Under the zone: above it sits the element's own toolbar.
        left: rect.x + rect.width / 2,
        top: rect.y + rect.height,
        transform: `translate(-50%, 0) scale(${1 / zoom}) translateY(18px)`,
        transformOrigin: 'top center',
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {onMoveStart ? (
        <>
          <Tooltip label="Drag to move">
            <button
              type="button"
              aria-label="Drag to move"
              data-zone-grip=""
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onMoveStart(e);
              }}
              className="flex h-7 w-6 cursor-grab touch-none items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <Grip />
            </button>
          </Tooltip>
          <Sep />
        </>
      ) : null}
      <Choice label="In line" pressed={fit === 'inline'} onPress={() => onFit('inline')}>
        <Inline />
      </Choice>
      <Choice label="Wrap left" pressed={fit === 'left'} onPress={() => onFit('left')}>
        <WrapLeft />
      </Choice>
      <Choice label="Wrap right" pressed={fit === 'right'} onPress={() => onFit('right')}>
        <WrapRight />
      </Choice>
      <Choice label="Float" pressed={fit === 'float'} onPress={() => onFit('float')}>
        <Float />
      </Choice>
      {fit === 'inline' ? (
        <>
          <Sep />
          <Choice label="Align left" pressed={align === 'left'} onPress={() => onAlign('left')}>
            <AlignLeft />
          </Choice>
          <Choice
            label="Align centre"
            pressed={align === 'center'}
            onPress={() => onAlign('center')}
          >
            <AlignCenter />
          </Choice>
          <Choice label="Align right" pressed={align === 'right'} onPress={() => onAlign('right')}>
            <AlignRight />
          </Choice>
        </>
      ) : null}
      {onRemove ? (
        <>
          <Sep />
          <Choice label={drawing ? 'Delete drawing' : 'Delete'} danger onPress={onRemove}>
            <TrashIcon className="h-4 w-4" />
          </Choice>
        </>
      ) : null}
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />;
}

function Choice({
  label,
  pressed,
  danger,
  onPress,
  children,
}: {
  label: string;
  pressed?: boolean;
  danger?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={danger ? undefined : pressed}
        onClick={onPress}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
          danger
            ? 'text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300'
            : pressed
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** A drawing zone's grips: its bottom edge (taller or shorter), its right edge (wider or narrower)
 *  and its bottom-right corner (both), previewed on the writing as they move; one edit on release,
 *  never smaller than what is drawn in it (the host clamps). */
export function ZoneResizeGrips({
  zoneId,
  rect,
  zoom,
  onResize,
}: {
  zoneId: string;
  rect: PageRect;
  zoom: number;
  onResize: (size: { width?: number; height?: number }) => void;
}) {
  const zoneEl = () =>
    document.querySelector<HTMLElement>(`.article-zone[data-block-id="${CSS.escape(zoneId)}"]`);
  const start = (e: React.PointerEvent<HTMLElement>, axes: { x: boolean; y: boolean }) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const el = zoneEl();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    let width = rect.width;
    let height = rect.height;
    const move = (ev: PointerEvent) => {
      if (axes.x) width = Math.max(24, rect.width + (ev.clientX - startX) / zoom);
      if (axes.y) height = Math.max(24, rect.height + (ev.clientY - startY) / zoom);
      if (el) {
        if (axes.x) el.style.width = `${width}px`;
        if (axes.y) el.style.height = `${height}px`;
      }
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      onResize({
        ...(axes.x ? { width: Math.round(width) } : {}),
        ...(axes.y ? { height: Math.round(height) } : {}),
      });
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  const steady = `translate(-50%, -50%) scale(${1 / zoom})`;
  return (
    <>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Drawing height"
        className="pointer-events-auto absolute flex cursor-ns-resize items-center justify-center"
        style={{
          left: rect.x + rect.width / 2,
          top: rect.y + rect.height,
          transform: steady,
          width: 44,
          height: 16,
        }}
        onPointerDown={(e) => start(e, { x: false, y: true })}
      >
        <span className="h-1.5 w-8 rounded-full bg-white shadow ring-1 ring-brand-500" />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Drawing width"
        className="pointer-events-auto absolute flex cursor-ew-resize items-center justify-center"
        style={{
          left: rect.x + rect.width,
          top: rect.y + rect.height / 2,
          transform: steady,
          width: 16,
          height: 44,
        }}
        onPointerDown={(e) => start(e, { x: true, y: false })}
      >
        <span className="h-8 w-1.5 rounded-full bg-white shadow ring-1 ring-brand-500" />
      </div>
      <div
        role="separator"
        aria-label="Drawing size"
        className="pointer-events-auto absolute flex cursor-nwse-resize items-center justify-center"
        style={{
          left: rect.x + rect.width,
          top: rect.y + rect.height,
          transform: steady,
          width: 18,
          height: 18,
        }}
        onPointerDown={(e) => start(e, { x: true, y: true })}
      >
        <span className="h-2.5 w-2.5 rounded-sm bg-white shadow ring-1 ring-brand-500" />
      </div>
    </>
  );
}
