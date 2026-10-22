'use client';

// A logo page's Mirror (docs/specs/007-editor/logo-pages.md "Mirror"): the button beside its cog,
// pressed while Mirror While Drawing is on for the page, opening a popover: the switch at the top,
// then the axis (Vertical, Horizontal, Both, Radial), Radial's copies, and Merge Into One. This
// page's own, for the session; a page turned on starts from the last settings chosen.
import type { ReactNode } from 'react';
import { MIRROR_AXES, RADIAL_COPIES } from '@livediagram/document';
import { SegmentedRadio } from '@/components/primitives/SegmentedRadio';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { MirrorAxisGlyph } from './logo-glyphs';
import { TitlePopoverButton } from './TitlePopoverButton';

// The popover's width: the axis tiles two across.
const POPOVER_WIDTH = 248;
const COPIES = RADIAL_COPIES.map((n) => ({ id: n, label: String(n) }));

/** The popover's body: Mirror While Drawing for the page, then its axis, copies and merge. */
export function LogoMirrorSettings({ pageId, tools }: { pageId: string; tools: LogoToolsView }) {
  const on = tools.mirrorOn(pageId);
  const settings = tools.mirrorSettings(pageId);
  return (
    <div data-logo-mirror-popover="" className="flex flex-col">
      <SwitchRow
        checked={on}
        onChange={(next) => tools.setMirror(pageId, next)}
        className="py-1 text-xs"
      >
        Mirror While Drawing
      </SwitchRow>
      {/* The settings, dimmed while off: choosing an axis turns it on. */}
      <div className={on ? '' : 'opacity-50'}>
        <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Axis</p>
        <div role="radiogroup" aria-label="Mirror axis" className="mt-1 grid grid-cols-2 gap-1">
          {MIRROR_AXES.map((axis) => {
            const chosen = settings.axis === axis.id;
            return (
              <button
                key={axis.id}
                type="button"
                role="radio"
                aria-checked={chosen}
                onClick={() => tools.setMirrorSettings(pageId, { axis: axis.id })}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
                  chosen
                    ? 'border-cyan-500/60 bg-cyan-50 text-cyan-900 dark:bg-cyan-500/15 dark:text-cyan-100'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <MirrorAxisGlyph axis={axis.id} size={14} />
                {axis.label}
              </button>
            );
          })}
        </div>
        {settings.axis === 'radial' ? (
          <>
            <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Copies
            </p>
            <SegmentedRadio
              label="Radial copies"
              options={COPIES}
              value={settings.copies}
              onChange={(copies) => tools.setMirrorSettings(pageId, { copies })}
              className="mt-1"
            />
          </>
        ) : null}
        <SwitchRow
          checked={settings.merge}
          onChange={(merge) => tools.setMirrorSettings(pageId, { merge })}
          className="mt-2 py-1 text-xs"
        >
          Merge Into One
        </SwitchRow>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {settings.merge
            ? 'Each drawing and its copies become one element.'
            : 'Each copy is its own element.'}
        </p>
      </div>
    </div>
  );
}

export function LogoMirrorButton({
  pageId,
  tools,
  labelled,
  className,
  children,
}: {
  pageId: string;
  tools: LogoToolsView;
  // Named beside its icon (a desktop).
  labelled: boolean;
  // The title bar's button look, pressed while mirror is on for the page.
  className: (on: boolean, labelled: boolean) => string;
  children: ReactNode;
}) {
  return (
    <TitlePopoverButton
      name="Mirror"
      on={tools.mirrorOn(pageId)}
      labelled={labelled}
      className={className}
      icon={children}
      width={POPOVER_WIDTH}
    >
      <LogoMirrorSettings pageId={pageId} tools={tools} />
    </TitlePopoverButton>
  );
}
