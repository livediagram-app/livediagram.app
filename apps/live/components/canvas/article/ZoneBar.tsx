'use client';

// The zone bar (docs/specs/007-editor/article-pages.md "Zones"): under a zone's bottom edge while the
// zone, or elements all in it, are selected. How it sits in the writing (In line, Wrap left, Wrap
// right), where an inline one sits across the text, and Delete (the zone and its elements). Drawn in
// canvas space at one screen size, so it rides the zone through a pan or a zoom.
import type { ReactNode } from 'react';
import {
  lucidePanelLeft,
  lucidePanelRight,
  lucideRows2,
  lucideTextAlignCenter,
  lucideTextAlignEnd,
  lucideTextAlignStart,
} from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip, TrashIcon } from '@livediagram/ui';
import type { ArticleZoneBlock, PageRect } from '@livediagram/document';
import type { ZoneAction } from '@/hooks/editor/useArticles';

const I = (g: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(g, 16);
const Inline = I(lucideRows2);
const WrapLeft = I(lucidePanelLeft);
const WrapRight = I(lucidePanelRight);
const AlignLeft = I(lucideTextAlignStart);
const AlignCenter = I(lucideTextAlignCenter);
const AlignRight = I(lucideTextAlignEnd);

export function ZoneBar({
  zone,
  rect,
  zoom,
  onAction,
}: {
  zone: ArticleZoneBlock;
  rect: PageRect;
  zoom: number;
  onAction: (action: ZoneAction) => void;
}) {
  const wrap = zone.wrap ?? 'inline';
  const align = zone.align ?? 'center';
  return (
    <div
      role="toolbar"
      aria-label={zone.zone === 'drawing' ? 'Drawing' : 'Object in the text'}
      data-article-keep-active=""
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
      <Choice
        label="In line"
        pressed={wrap === 'inline'}
        onPress={() => onAction({ wrap: 'inline' })}
      >
        <Inline />
      </Choice>
      <Choice
        label="Wrap left"
        pressed={wrap === 'left'}
        onPress={() => onAction({ wrap: 'left' })}
      >
        <WrapLeft />
      </Choice>
      <Choice
        label="Wrap right"
        pressed={wrap === 'right'}
        onPress={() => onAction({ wrap: 'right' })}
      >
        <WrapRight />
      </Choice>
      {wrap === 'inline' ? (
        <>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <Choice
            label="Align left"
            pressed={align === 'left'}
            onPress={() => onAction({ align: 'left' })}
          >
            <AlignLeft />
          </Choice>
          <Choice
            label="Align centre"
            pressed={align === 'center'}
            onPress={() => onAction({ align: 'center' })}
          >
            <AlignCenter />
          </Choice>
          <Choice
            label="Align right"
            pressed={align === 'right'}
            onPress={() => onAction({ align: 'right' })}
          >
            <AlignRight />
          </Choice>
        </>
      ) : null}
      <span aria-hidden className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <Choice
        label={zone.zone === 'drawing' ? 'Delete drawing' : 'Delete'}
        danger
        onPress={() => onAction({ remove: true })}
      >
        <TrashIcon className="h-4 w-4" />
      </Choice>
    </div>
  );
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

/** A drawing zone's bottom grip: drag to make it taller or shorter (previewed on the writing as it
 *  moves; one edit on release, never shorter than what is drawn in it). */
export function ZoneResizeGrip({
  zoneId,
  rect,
  zoom,
  onResize,
}: {
  zoneId: string;
  rect: PageRect;
  zoom: number;
  onResize: (height: number) => void;
}) {
  const zoneEl = () =>
    document.querySelector<HTMLElement>(`.article-zone[data-block-id="${CSS.escape(zoneId)}"]`);
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Drawing height"
      className="pointer-events-auto absolute flex cursor-ns-resize items-center justify-center"
      style={{
        left: rect.x + rect.width / 2,
        top: rect.y + rect.height,
        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
        width: 44,
        height: 16,
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        const startY = e.clientY;
        const el = zoneEl();
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        let height = rect.height;
        const move = (ev: PointerEvent) => {
          height = Math.max(24, rect.height + (ev.clientY - startY) / zoom);
          if (el) el.style.height = `${height}px`;
        };
        const up = () => {
          target.removeEventListener('pointermove', move);
          target.removeEventListener('pointerup', up);
          target.removeEventListener('pointercancel', up);
          onResize(Math.round(height));
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', up);
      }}
    >
      <span className="h-1.5 w-8 rounded-full bg-white shadow ring-1 ring-brand-500" />
    </div>
  );
}
