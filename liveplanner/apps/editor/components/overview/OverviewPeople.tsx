import { GlyphDisc, IDENTITY_FILL, Tooltip, identityVars } from '@liveplanner/ui';
import { initialsOf } from '@liveplanner/project';
import { PEOPLE_SHOWN, PEOPLE_SHOWN_NARROW, type PlanPerson } from './overview-people';

// One column: a disc with a short line under it, cut to the column's width.
const COLUMN =
  'flex w-16 flex-col items-center gap-1 rounded-lg py-1 outline-none focus-visible:outline-2 focus-visible:outline-brand-600';
const CAPTION =
  'w-full truncate text-center text-[11px] leading-4 text-[var(--ov-head-ink,var(--color-slate-700))] dark:text-[var(--ov-head-ink,var(--color-brand-100))]';
const RING =
  'ring-2 ring-[var(--ov-head-paper,var(--color-brand-50))] dark:ring-[var(--ov-head-paper,var(--color-brand-950))]';

// "+N" labelled More, naming the rest on hover and focus. Two are drawn, one per width, since a narrow header shows
// fewer people (PEOPLE_SHOWN_NARROW) than a wide one (PEOPLE_SHOWN).
function More({ names, className }: { names: readonly string[]; className: string }) {
  if (names.length === 0) return null;
  const list = names.join(', ');
  return (
    <li className={className} data-overview-more={names.length}>
      <Tooltip label={list}>
        <span
          tabIndex={0}
          role="img"
          aria-label={`More: ${list}`}
          className={`${COLUMN} cursor-default`}
        >
          <GlyphDisc
            size={32}
            as="span"
            className={`bg-slate-200 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100 ${RING}`}
          >
            +{names.length}
          </GlyphDisc>
          <span className={CAPTION}>More</span>
        </span>
      </Tooltip>
    </li>
  );
}

// The people on the plan (docs/specs/026-plan/plan-overview.md "Header"): a row of discs, each with the person's name
// under it, at most PEOPLE_SHOWN (PEOPLE_SHOWN_NARROW on a narrow screen), then More for the rest.
export function OverviewPeople({ people }: { people: readonly PlanPerson[] }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, PEOPLE_SHOWN);
  const names = people.map((p) => p.name);
  return (
    // The band's bottom right; on its own line, still right, when it cannot share one with the text.
    <ul
      className="ml-auto flex shrink-0 gap-1"
      aria-label="People on the plan"
      data-overview-people=""
    >
      {shown.map((p, i) => (
        // Past what a narrow screen shows, a person is drawn only from sm.
        <li key={p.id} className={i >= PEOPLE_SHOWN_NARROW ? 'max-sm:hidden' : undefined}>
          <Tooltip label={p.name}>
            <span
              tabIndex={0}
              role="img"
              aria-label={p.name}
              className={`${COLUMN} cursor-default`}
            >
              <GlyphDisc
                size={32}
                as="span"
                style={identityVars(p.color)}
                className={`text-[11px] font-bold text-white ${RING} ${IDENTITY_FILL}`}
              >
                {initialsOf(p.name)}
              </GlyphDisc>
              <span className={CAPTION}>{p.name}</span>
            </span>
          </Tooltip>
        </li>
      ))}
      <More names={names.slice(PEOPLE_SHOWN_NARROW)} className="sm:hidden" />
      <More names={names.slice(PEOPLE_SHOWN)} className="max-sm:hidden" />
    </ul>
  );
}
