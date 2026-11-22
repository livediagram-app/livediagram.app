'use client';

// Page Info's Required Reading section (docs/specs/030-knowledgebase/required-reading.md "Where it shows"), under
// Page Health. Not required: for an Editor alone, one line and Require Reading. Required, for every reader: who is
// asked, a bar and "7 of 12 have read it" (a count, never who), and their own state. For an Editor and the page's
// owner, the people too, Not Yet first then Read, and Remind; an Editor also has Change, which opens the setup panel.
// What it shows is what the api answered: names only ever arrive for those who may see them.
import { useState } from 'react';
import type { PageReadingPerson, PageReadingResponse } from '@liveknowledge/api-schema';
import { Button } from '@liveknowledge/ui';
import { Disc, RAIL_LABEL } from '@/components/knowledge/PageHealthCard';
import { useKnowledgePeople, type KnowledgePerson } from '@/components/knowledge/usePageKnowledge';
import { shortDate } from '@/lib/knowledge/page-trust';
import { useRelativeNow } from '@/lib/relative-time';
import { audienceText, lastRemindedText, progressText } from '@/lib/required-reading/reading-words';
import { AudienceIcon, ReadTickIcon, RemindIcon } from './reading-icons';
import { ReadingSetupPanel } from './ReadingSetupPanel';
import { useRequiredReading, type RequiredReadingView } from './useRequiredReading';

const SMALL =
  'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 ring-inset ring-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:opacity-60 phone:h-9 phone:px-3 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800';

/** Each group lists this many before Show All: a long list stays a rail, not a wall. */
const GROUP_SHOWN = 8;

function ProgressBar({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  const words = progressText(done, total);
  return (
    <div
      role="progressbar"
      aria-label="Read so far"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={words}
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
    >
      <div
        className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-200 ${
          share >= 1 ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-brand-600 dark:bg-brand-400'
        }`}
        style={{ width: `${share * 100}%` }}
      />
    </div>
  );
}

function PersonRow({ person, now }: { person: PageReadingPerson; now: number }) {
  return (
    <li data-reading-person={person.id} className="flex min-h-8 items-center gap-2.5">
      <Disc name={person.name} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800 dark:text-slate-200">
        {person.name}
      </span>
      {person.readAt !== undefined ? (
        <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {shortDate(person.readAt, now)}
        </span>
      ) : null}
    </li>
  );
}

function PeopleGroup({
  label,
  people,
  now,
}: {
  label: string;
  people: readonly PageReadingPerson[];
  now: number;
}) {
  const [all, setAll] = useState(false);
  if (people.length === 0) return null;
  const shown = all ? people : people.slice(0, GROUP_SHOWN);
  return (
    <section aria-label={label} data-reading-group={label}>
      <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label} <span className="tabular-nums">({people.length.toLocaleString('en')})</span>
      </h3>
      <ul className="mt-1 flex flex-col">
        {shown.map((person) => (
          <PersonRow key={person.id} person={person} now={now} />
        ))}
      </ul>
      {shown.length < people.length ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          data-reading-show-all=""
          className="mt-1 cursor-pointer rounded-md text-xs font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-9 dark:text-brand-300"
        >
          Show all {people.length.toLocaleString('en')}
        </button>
      ) : null}
    </section>
  );
}

/** The section itself, for its tests: the page's state, the people the editor knows and the presses. */
export function PageRailReadingView({
  reading,
  people,
  now,
  busy,
  onConfirm,
  onSet,
  onRemind,
}: {
  reading: PageReadingResponse;
  people: readonly KnowledgePerson[];
  now: number;
  busy: RequiredReadingView['busy'];
  onConfirm: () => void;
  onSet: RequiredReadingView['set'];
  onRemind: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { required, progress, mine, manages, sees } = reading;
  if (!required && !manages) return null;
  const panel = manages ? (
    <ReadingSetupPanel
      anchor={anchor}
      onClose={() => setAnchor(null)}
      audience={required?.audience ?? null}
      chosen={reading.chosen ?? []}
      people={people}
      busy={busy === 'set'}
      onSave={(change) => void onSet(change).then((saved) => saved && setAnchor(null))}
    />
  ) : null;
  const open = (e: React.MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  if (!required)
    return (
      <section
        data-page-reading="off"
        className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
      >
        <h2 className={RAIL_LABEL}>Required Reading</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Ask people to confirm they&apos;ve read this page.
        </p>
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          data-reading-require=""
          className={`${SMALL} mt-2.5`}
        >
          Require Reading
        </button>
        {panel}
      </section>
    );
  const done = progress?.done ?? 0;
  const total = progress?.total ?? 0;
  const list = reading.people ?? [];
  const notYet = list.filter((p) => p.readAt === undefined);
  const read = list.filter((p) => p.readAt !== undefined);
  return (
    <section
      data-page-reading={required.audience}
      className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className={RAIL_LABEL}>Required Reading</h2>
        {manages ? (
          <button
            type="button"
            onClick={open}
            aria-haspopup="dialog"
            aria-expanded={anchor !== null}
            aria-label="Change Required Reading"
            data-reading-change=""
            className="cursor-pointer rounded-md px-1 text-xs font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-9 dark:text-brand-300"
          >
            Change
          </button>
        ) : null}
      </div>
      <p className="mt-2 flex items-center gap-2 text-slate-600 dark:text-slate-400">
        <span aria-hidden className="flex text-slate-400">
          <AudienceIcon />
        </span>
        {audienceText(required.audience, total)}
      </p>
      <div className="mt-2.5">
        <ProgressBar done={done} total={total} />
        <p
          data-reading-progress=""
          className="mt-1.5 text-xs tabular-nums text-slate-600 dark:text-slate-400"
        >
          {progressText(done, total)}
        </p>
      </div>
      {mine.asked ? (
        mine.readAt !== undefined ? (
          <p
            data-reading-mine="read"
            className="mt-3 flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300"
          >
            <ReadTickIcon />
            You read it {shortDate(mine.readAt, now)}
          </p>
        ) : (
          <div
            data-reading-mine="pending"
            className="mt-3 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="text-slate-600 dark:text-slate-400">
              You haven&apos;t confirmed yet
            </span>
            <Button
              size="xs"
              busy={busy === 'confirm'}
              onClick={onConfirm}
              className="phone:min-h-11"
            >
              <ReadTickIcon />
              I&apos;ve Read This
            </Button>
          </div>
        )
      ) : null}
      {sees ? (
        <div className="mt-4 flex flex-col gap-3">
          <PeopleGroup label="Not Yet" people={notYet} now={now} />
          <PeopleGroup label="Read" people={read} now={now} />
          {reading.email && notYet.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <button
                type="button"
                onClick={onRemind}
                disabled={busy === 'remind'}
                aria-busy={busy === 'remind' || undefined}
                data-reading-remind=""
                className={SMALL}
              >
                <RemindIcon />
                Remind
              </button>
              {reading.remindedAt !== undefined ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {lastRemindedText(reading.remindedAt, now)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {panel}
    </section>
  );
}

export function PageRailReading() {
  const reading = useRequiredReading();
  const { people } = useKnowledgePeople();
  const now = useRelativeNow();
  if (!reading.shown) return null;
  return (
    <PageRailReadingView
      reading={reading.entry.reading}
      people={people}
      now={now}
      busy={reading.busy}
      onConfirm={reading.confirm}
      onSet={reading.set}
      onRemind={reading.remind}
    />
  );
}
