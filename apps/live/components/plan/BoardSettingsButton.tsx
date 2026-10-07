'use client';

// A board's own settings cog (docs/specs/026-plan/plan-board.md "The board set-up"): in its header, left of Maximise,
// for someone who may edit. It opens a popover holding the same Board and Cards settings as the board's element
// menu, each under its heading, both open, so the board is set up without the right-click menu. A press outside or
// Escape closes it, handing focus back to the cog.
import { useState, type ReactNode } from 'react';
import type { ShapeElement } from '@livediagram/document';
import { ChevronDownIcon, PlanCardsIcon, PlanIcon, Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideSettings } from '@livediagram/icons/lucide';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { PlanBoardSettings, PlanCardsSettings } from '@/components/palette/PlanBoardMenuSection';
import type { PlanPalette } from './plan-palette';
import { track } from '@/lib/telemetry';

const CogIcon = lucideGlyph(lucideSettings, 16);
const POPOVER_PX = 360;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BoardSettingsButton({
  element,
  palette,
}: {
  element: ShapeElement;
  palette: PlanPalette;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // One section open at a time: Board when the popover opens.
  const [section, setSection] = useState<'board' | 'cards' | null>('board');
  return (
    <>
      <Tooltip label="Board Settings">
        <button
          type="button"
          aria-label="Board Settings"
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
          style={{ color: palette.muted }}
          onPointerDown={stop}
          onClick={(e) => {
            e.stopPropagation();
            if (anchor) {
              setAnchor(null);
              return;
            }
            setAnchor(e.currentTarget);
            setSection('board');
            track('Plan', 'Opened', 'BoardSettings');
          }}
        >
          <CogIcon />
        </button>
      </Tooltip>
      {anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name="Board Settings"
          width={POPOVER_PX}
          onClose={() => setAnchor(null)}
        >
          <div
            className="flex flex-col rounded-lg border border-slate-200 bg-white py-1 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            // A press in the settings is the popover's, never the canvas's or the board's.
            onPointerDown={stop}
          >
            <SettingsSection
              title="Board"
              icon={<PlanIcon size={16} />}
              open={section === 'board'}
              onToggle={() => setSection(section === 'board' ? null : 'board')}
            >
              <PlanBoardSettings element={element} />
            </SettingsSection>
            <SettingsSection
              title="Cards"
              icon={<PlanCardsIcon size={16} />}
              open={section === 'cards'}
              onToggle={() => setSection(section === 'cards' ? null : 'cards')}
            >
              <PlanCardsSettings element={element} />
            </SettingsSection>
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}

// One collapsible group; the popover keeps one open at a time.
function SettingsSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
        onClick={onToggle}
      >
        <span className="text-slate-400 dark:text-slate-400">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDownIcon className={`transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open ? <div className="pb-1">{children}</div> : null}
    </section>
  );
}
