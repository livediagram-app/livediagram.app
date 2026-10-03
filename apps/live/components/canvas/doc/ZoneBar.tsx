'use client';

// The zone bar (docs/specs/007-editor/document-pages.md "Zones"): under a zone's bottom edge while the
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
import type { DocZoneBlock, PageRect } from '@livediagram/document';
import type { ZoneAction } from '@/hooks/editor/useDocumentPages';

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
  zone: DocZoneBlock;
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
      data-doc-keep-active=""
      className="pointer-events-auto absolute flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
      style={{
        // Under the zone: above it sits the element's own toolbar.
        left: rect.x + rect.width / 2,
        top: rect.y + rect.height,
        transform: `translate(-50%, 0) scale(${1 / zoom}) translateY(12px)`,
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
