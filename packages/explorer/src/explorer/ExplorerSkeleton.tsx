// The Explorer's shape while the host is still finding out who is here (liveworkspace.app asks for the person's token
// before the Explorer may ask the index anything, seconds on a slow session): the sidebar's three groups of rows and
// a pane of cards under its title, pulsing, laid out exactly as <Explorer> lays out its `main`, so nothing jumps when
// the real one replaces it. Static: no state, no requests, no effects.

import { CARD_GRID, EXPLORER_MAIN, SKELETON } from '../ui/classes';

// The sidebar's groups as the person usually sees them: Overview's four rows, Spaces' My Work and a team, More's two.
const GROUPS: readonly { title: string; rows: readonly string[] }[] = [
  { title: 'w-16', rows: ['w-14', 'w-12', 'w-16', 'w-28'] },
  { title: 'w-12', rows: ['w-20', 'w-24'] },
  { title: 'w-10', rows: ['w-16', 'w-12'] },
];
const CARDS = 6;

export function ExplorerSkeleton() {
  return (
    <>
      {/* A phone's sections bar (PhoneSections.tsx), its height held so the page under it never moves. */}
      <div
        aria-hidden
        className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200/70 px-4 sm:hidden dark:border-slate-800/70"
      >
        <div className={`size-[18px] shrink-0 ${SKELETON}`} />
        <div className={`h-3.5 w-24 ${SKELETON}`} />
      </div>
      <main aria-busy data-explorer-skeleton="" className={EXPLORER_MAIN}>
        <span role="status" className="sr-only">
          Loading the Explorer
        </span>
        <div aria-hidden className="hidden w-64 shrink-0 self-start px-1 py-1 sm:block">
          {GROUPS.map((group, g) => (
            <div key={group.title + g} className={g === 0 ? '' : 'mt-6 pt-1'}>
              <div className="box-content h-4 px-2.5 pb-2">
                <div className={`h-2.5 ${group.title} ${SKELETON}`} />
              </div>
              {group.rows.map((width, r) => (
                <div key={r} className="flex items-center gap-2.5 py-1.5 pl-7 pr-1">
                  <div className={`size-6 shrink-0 !rounded-lg ${SKELETON}`} />
                  <div className={`h-3 ${width} ${SKELETON}`} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div aria-hidden className="min-w-0 flex-1">
          <div className="mb-6 flex items-center gap-2">
            <div className={`h-7 w-40 ${SKELETON}`} />
          </div>
          <div className={CARD_GRID}>
            {Array.from({ length: CARDS }, (_, i) => (
              <div key={i}>
                <div className={`h-48 !rounded-xl ${SKELETON}`} />
                <div className={`mt-3 h-3.5 w-2/3 ${SKELETON}`} />
                <div className={`mt-2 h-3 w-1/3 ${SKELETON}`} />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
