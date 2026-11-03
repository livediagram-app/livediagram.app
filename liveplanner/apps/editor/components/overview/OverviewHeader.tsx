import {
  Button,
  GlyphDisc,
  IDENTITY_FILL,
  PencilIcon,
  Tooltip,
  identityVars,
} from '@liveplanner/ui';
import { initialsOf } from '@liveplanner/project';
import { PEOPLE_SHOWN, type PlanPerson } from './overview-people';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The people on the plan as overlapping discs, at most PEOPLE_SHOWN, then "+N", and how many there are.
function OverviewPeople({ people }: { people: readonly PlanPerson[] }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, PEOPLE_SHOWN);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center gap-2.5" data-overview-people="">
      <ul className="flex pl-2" aria-label="People on the plan">
        {shown.map((p) => (
          <li key={p.id} className="-ml-2">
            <Tooltip label={p.name}>
              <GlyphDisc
                size={32}
                as="span"
                tabIndex={0}
                aria-label={p.name}
                style={identityVars(p.color)}
                className={`text-[11px] font-bold text-white ring-2 ring-brand-50 dark:ring-brand-950 ${IDENTITY_FILL}`}
              >
                {initialsOf(p.name)}
              </GlyphDisc>
            </Tooltip>
          </li>
        ))}
        {rest > 0 ? (
          <li className="-ml-2">
            <GlyphDisc
              size={32}
              as="span"
              className="bg-slate-200 text-[11px] font-semibold text-slate-700 ring-2 ring-brand-50 dark:bg-slate-700 dark:text-slate-100 dark:ring-brand-950"
            >
              +{rest}
            </GlyphDisc>
          </li>
        ) : null}
      </ul>
      <span className="text-xs text-brand-800 dark:text-brand-200">
        {plural(people.length, 'Person', 'People')}
      </span>
    </div>
  );
}

// The Overview's header band (docs/specs/026-plan/plan-overview.md "Header"): the plan's name, description and dates,
// the people on it, and Edit Details and Share for whoever may use them.
export function OverviewHeader({
  name,
  description,
  dates,
  datesTitle,
  people,
  onEditDetails,
  onShare,
}: {
  name: string;
  description: string;
  dates: string | null;
  // The exact last edit, on hover over the dates line.
  datesTitle?: string | undefined;
  people: readonly PlanPerson[];
  // Absent for anyone who may not edit the plan's details.
  onEditDetails?: (() => void) | undefined;
  // Absent for anyone who may not share the plan, and for a plan in This Browser.
  onShare?: (() => void) | undefined;
}) {
  return (
    <section
      aria-labelledby="overview-title"
      className="flex flex-col gap-5 border-b border-brand-100 bg-brand-50 px-4 pb-6 pt-7 sm:px-10 md:flex-row md:items-end md:justify-between dark:border-brand-900 dark:bg-brand-950"
    >
      <div className="flex min-w-0 max-w-[720px] flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700 dark:text-brand-300">
          Plan Overview
        </span>
        <h1
          id="overview-title"
          className="break-words text-[28px] font-bold leading-tight tracking-tight text-slate-950 sm:text-[34px] dark:text-white"
        >
          {name || 'Untitled'}
        </h1>
        {description ? (
          <p
            data-overview-description=""
            className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-700 dark:text-brand-100"
          >
            {description}
          </p>
        ) : onEditDetails ? (
          <button
            type="button"
            onClick={onEditDetails}
            className="w-fit cursor-pointer rounded text-sm text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300"
          >
            Add a Description
          </button>
        ) : null}
        {dates ? (
          <Tooltip label={datesTitle ?? ''}>
            <span className="w-fit text-xs text-slate-600 dark:text-brand-200">{dates}</span>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 md:items-end">
        <OverviewPeople people={people} />
        {onEditDetails || onShare ? (
          <div className="flex gap-2">
            {onEditDetails ? (
              <Button variant="secondary" size="sm" onClick={onEditDetails}>
                <PencilIcon size={14} />
                Edit Details
              </Button>
            ) : null}
            {onShare ? (
              <Button variant="primary" size="sm" onClick={onShare}>
                Share
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
