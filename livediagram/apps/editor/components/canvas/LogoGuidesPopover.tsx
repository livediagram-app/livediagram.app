'use client';

// A logo page's Guides (docs/specs/007-editor/logo-pages.md "Beside the cog"): the button beside
// its cog, pressed while the page shows its guides, opening a popover: Show Guides for this page at
// the top, then which guides show and how strongly (the person's synced preferences, also in
// Settings).
import type { ReactNode } from 'react';
import { SegmentedRadio } from '@/components/primitives/SegmentedRadio';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { LOGO_GUIDE_PARTS, LOGO_GUIDE_STRENGTHS } from '@/lib/logo-guide-prefs';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { TitlePopoverButton } from './TitlePopoverButton';

// The popover's width: the part tiles two across.
const POPOVER_WIDTH = 248;

/** The popover's body: Show Guides for the page, then the parts and Strength. */
export function LogoGuidesSettings({ pageId, tools }: { pageId: string; tools: LogoToolsView }) {
  const guides = tools.guidesOn(pageId);
  return (
    <div data-logo-guides-popover="" className="flex flex-col">
      <SwitchRow
        checked={guides}
        onChange={(on) => tools.setGuides(pageId, on)}
        className="py-1 text-xs"
      >
        Show Guides
      </SwitchRow>
      {/* Which guides show and how strongly, dimmed while the page shows none. */}
      <div className={guides ? '' : 'opacity-50'}>
        <div role="group" aria-label="Which guides show" className="mt-2 grid grid-cols-2 gap-1">
          {LOGO_GUIDE_PARTS.map((part) => {
            const on = tools.guideParts.has(part.id);
            return (
              <button
                key={part.id}
                type="button"
                aria-pressed={on}
                onClick={() => tools.setGuidePart(part.id, !on)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
                  on
                    ? 'border-cyan-500/60 bg-cyan-50 text-cyan-900 dark:bg-cyan-500/15 dark:text-cyan-100'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${on ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                />
                {part.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">Strength</p>
        <SegmentedRadio
          label="Guide strength"
          options={LOGO_GUIDE_STRENGTHS}
          value={tools.guideStrength}
          onChange={tools.setGuideStrength}
          className="mt-1"
        />
      </div>
    </div>
  );
}

export function LogoGuidesButton({
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
  // The title bar's button look, pressed while the page shows its guides.
  className: (on: boolean, labelled: boolean) => string;
  children: ReactNode;
}) {
  return (
    <TitlePopoverButton
      name="Guides"
      on={tools.guidesOn(pageId)}
      labelled={labelled}
      className={className}
      icon={children}
      width={POPOVER_WIDTH}
    >
      <LogoGuidesSettings pageId={pageId} tools={tools} />
    </TitlePopoverButton>
  );
}
