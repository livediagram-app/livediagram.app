'use client';

// Zen mode's one button at the foot of the page (docs/specs/007-editor/zen-mode.md): the way back out while zen
// hides every other control, and the way in for a session with no bar to enter it from (a Viewer, a Participant).
// It stands where the fork's zoom cluster stood: a knowledgebase page has no zoom of its own
// (docs/specs/030-knowledgebase/page-surface.md "No zoom and no panning"), the browser's zoom is the page's.
import { HoverCard } from '@liveknowledge/ui';
import { ZenExitIcon, ZenIcon } from '@/components/palette/palette-icons';

export function ZenControl({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const label = active ? 'Exit Zen Mode' : 'Zen Mode';
  return (
    <div
      data-zen-control=""
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto flex animate-fade-in items-center rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900"
    >
      <HoverCard
        title={label}
        description={
          active
            ? 'Bring back the bars and panels (Z or Esc).'
            : 'Hide every bar and panel to read the page (Z).'
        }
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label={label}
          aria-pressed={active}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-slate-600 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 phone:w-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          {active ? <ZenExitIcon /> : <ZenIcon />}
        </button>
      </HoverCard>
    </div>
  );
}
