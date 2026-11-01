'use client';

// The preview of a board from another tool (docs/specs/026-plan/tracker-import.md "The preview"): what the import
// will make before anything is written. The source and board, its columns with their cards, how the file's fields map
// to card fields, the people, the comments and what is left out, then where it goes: a new Board tab of this plan
// (dimmed with its reason when the plan has no room) or a new plan.
import type { ReactNode } from 'react';
import type { TrackerPreview } from '@liveplanner/items';
import { OptionRows } from '@/components/plan/OptionRows';
import type { TrackerTarget } from '@/hooks/plan/useTrackerImport';
import {
  BoardTabIcon,
  ColumnsIcon,
  CommentsIcon,
  FieldsIcon,
  LeftOutIcon,
  NewPlanIcon,
  PeopleIcon,
} from './tracker-icons';

const count = (n: number) => n.toLocaleString('en-GB');
const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

function Section({
  icon,
  title,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        <span aria-hidden className="text-slate-400 dark:text-slate-400">
          {icon}
        </span>
        {title}
        {aside ? (
          <span className="ml-auto font-normal text-slate-500 tabular-nums dark:text-slate-400">
            {aside}
          </span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

const QUIET = 'text-[13px] leading-relaxed text-slate-600 dark:text-slate-300';

// "3 matched to team members, 2 already on this plan and 4 new named people", or none.
export function peopleLine(people: TrackerPreview['people']): string {
  const parts = [
    people.matched ? `${plural(people.matched, 'person', 'people')} matched to team members` : '',
    people.onPlan ? `${count(people.onPlan)} already on this plan` : '',
    people.named ? `${plural(people.named, 'new named person', 'new named people')}` : '',
  ].filter(Boolean);
  if (parts.length === 0) return 'No one is assigned on these cards.';
  return parts.length === 1
    ? `${parts[0]}.`
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
}

export function TrackerPreviewView({
  preview,
  target,
  tabReason,
  onTarget,
  disabled,
}: {
  preview: TrackerPreview;
  target: TrackerTarget;
  // Why this plan can't take it (no room for its cards or its card type); the tab choice is dimmed with it.
  tabReason: string | undefined;
  onTarget: (target: TrackerTarget) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {preview.sourceName} {preview.source === 'trello' ? 'board' : 'export'} ·{' '}
          </span>
          {preview.title}
        </p>
        <p className="shrink-0 text-[13px] text-slate-500 tabular-nums dark:text-slate-400">
          {plural(preview.cards, 'card')}
        </p>
      </div>

      <Section icon={<ColumnsIcon />} title="Columns" aside={count(preview.columns.length)}>
        <ul className="flex flex-wrap gap-1.5">
          {preview.columns.map((c) => (
            <li
              key={c.name}
              className="flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            >
              <span className="truncate">{c.name}</span>
              <span className="text-slate-400 tabular-nums dark:text-slate-400">
                {count(c.cards)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={<FieldsIcon />} title="Fields" aside={`${preview.typeName} card type`}>
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full table-fixed text-left text-[12px]">
            <thead className="bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th scope="col" className="w-[38%] px-3 py-1.5 font-medium">
                  From {preview.sourceName}
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Becomes
                </th>
                <th scope="col" className="w-16 px-3 py-1.5 text-right font-medium">
                  Cards
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {preview.fields.map((f) => (
                <tr key={`${f.from}:${f.to}`} className="text-slate-700 dark:text-slate-200">
                  <td className="truncate px-3 py-1.5">{f.from}</td>
                  <td className="px-3 py-1.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{f.to}</span>
                      {f.isNew ? (
                        <span className="shrink-0 rounded bg-brand-50 px-1.5 py-px text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                          New Field
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums dark:text-slate-400">
                    {count(f.cards)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section icon={<PeopleIcon />} title="People">
          <p className={QUIET}>{peopleLine(preview.people)}</p>
        </Section>
        <Section icon={<CommentsIcon />} title="Comments">
          <p className={QUIET}>
            {preview.comments.count
              ? `${plural(preview.comments.count, 'comment')} on ${plural(preview.comments.cards, 'card')}, in an Imported comments thread on each.`
              : `No comments come with this ${preview.sourceName} export.`}
          </p>
        </Section>
      </div>

      <Section icon={<LeftOutIcon />} title="Left Out">
        {preview.skips.length ? (
          <ul className="flex flex-col gap-1">
            {preview.skips.map((s) => (
              <li key={s.reason} className={`flex justify-between gap-3 ${QUIET}`}>
                <span>{s.label}</span>
                <span className="text-slate-500 tabular-nums dark:text-slate-400">
                  {count(s.count)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={QUIET}>Nothing left out.</p>
        )}
      </Section>

      <Section icon={<BoardTabIcon size={14} />} title="Where To">
        <OptionRows
          kind="single"
          label="Where to import it"
          selected={target}
          onPick={(id) => onTarget(id as TrackerTarget)}
          rows={[
            {
              id: 'tab',
              label: 'New Board Tab in This Plan',
              icon: <BoardTabIcon />,
              detail: tabReason ?? `After the open tab, with the ${preview.typeName} card type.`,
              disabled: disabled || !!tabReason,
            },
            {
              id: 'plan',
              label: 'New Plan',
              icon: <NewPlanIcon />,
              detail: 'A plan of its own, opened once it is made.',
              disabled,
            },
          ]}
        />
        {tabReason ? (
          <p
            role="status"
            className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
          >
            {tabReason} It goes into a new plan instead, whole.
          </p>
        ) : null}
      </Section>
    </div>
  );
}
