'use client';

// A team's Audit Log, on its view under Team Activity (liveworkspace/docs/specs/004-index/team-audit-log.md "The Audit
// Log on a team's view"): the team's admins alone see it. Closed until opened, like Team Activity, so nothing is read
// until asked for. Open, it is the filters (Person, Event, From, To), Export CSV, and the rows under day bands, newest
// first, a page at a time.

import { useId, useMemo, useState } from 'react';
import {
  isApp,
  TEAM_AUDIT_EVENT_LABELS,
  type TeamAuditEvent,
  type TeamAuditEventType,
  isTeamAuditEventType,
} from '@liveworkspace/index-client';
import { Button, DateInput, EmptyState, Select } from '@liveworkspace/ui';
import { downloadBlob } from '@liveworkspace/ui/download-blob';
import { MEDIUM_DATE, TIME } from '@liveworkspace/ui/date-format';
import type { TeamMember } from '../../data/teams';
import { memberName } from '../../teams/rules';
import { auditIcon, ShieldIcon } from '../../timeline/icons';
import { LIST_CARD, MUTED, SKELETON } from '../../ui/classes';
import { ChevronDownIcon } from '../../ui/icons';
import { HistoryIcon } from '../../ui/library-icons';
import { useToast } from '../../ui/Toasts';
import { siteOf } from '../../words';
import { AppMark } from '../badges';
import { useExplorer } from '../context';
import { MoreFailed } from '../MoreFailed';
import { AUDIT_GROUPS, auditDetail, auditSentence, dayRange, fileSlug, personWords } from './rows';
import { exportAuditCsv, useAuditLog, type AuditFilter } from './useAuditLog';

export const AUDIT_LOG_TITLE = 'Audit Log';

// The two selects at the date fields' height and 13px type, so the four filters line up in one row.
const FILTER_SELECT = 'h-[34px] text-[13px]';

/** The section, closed by default. Drawn only for a team admin; keyed on the team by its caller. */
export function AuditLog({
  teamId,
  teamName,
  members,
  helpHref,
}: {
  teamId: string;
  teamName: string;
  members: readonly TeamMember[];
  helpHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <section className={LIST_CARD} data-audit-log={teamId}>
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((was) => !was)}
          className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition duration-micro hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 dark:text-slate-100 dark:hover:bg-slate-800/60"
        >
          <span className="text-emerald-600 dark:text-emerald-400" aria-hidden>
            <ShieldIcon size={14} />
          </span>
          <span className="flex-1">{AUDIT_LOG_TITLE}</span>
          <span className={`text-xs font-normal ${MUTED}`}>Admins only · kept a year</span>
          <span
            aria-hidden
            className={`transition-transform duration-micro ${open ? 'rotate-180' : ''}`}
          >
            <ChevronDownIcon />
          </span>
        </button>
      </h2>
      {open ? (
        <div id={bodyId} className="border-t border-slate-100 px-4 py-4 dark:border-slate-700/60">
          <AuditBody teamId={teamId} teamName={teamName} members={members} helpHref={helpHref} />
        </div>
      ) : null}
    </section>
  );
}

type Filters = {
  person: string;
  // The chosen person's name, so the choice stays offered while their rows load.
  personLabel?: string;
  kind: TeamAuditEventType | '';
  from?: string;
  to?: string;
};
const NO_FILTERS: Filters = { person: '', kind: '' };

const FIELD_LABEL = `mb-1 block text-xs font-medium ${MUTED}`;

function AuditBody({
  teamId,
  teamName,
  members,
  helpHref,
}: {
  teamId: string;
  teamName: string;
  members: readonly TeamMember[];
  helpHref?: string;
}) {
  const { client } = useExplorer();
  const toast = useToast();
  const ids = useId();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const filtered = Boolean(filters.person || filters.kind || filters.from || filters.to);
  const query = useMemo<AuditFilter>(() => {
    const range = dayRange(filters.from, filters.to);
    return {
      team: teamId,
      ...(filters.person ? { person: filters.person } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(range.from !== undefined ? { from: range.from } : {}),
      ...(range.to !== undefined ? { to: range.to } : {}),
    };
  }, [teamId, filters]);
  const log = useAuditLog(client, query);
  const people = usePeopleOptions(members, log.events, filters.person, filters.personLabel);
  const days = useMemo(() => byDay(log.events), [log.events]);
  const [exporting, setExporting] = useState<number | null>(null);

  const set = (patch: Partial<Filters>) => setFilters((was) => ({ ...was, ...patch }));

  async function exportCsv() {
    if (exporting !== null) return;
    setExporting(0);
    try {
      const done = await exportAuditCsv(client, query, setExporting);
      const day = new Date().toISOString().slice(0, 10);
      downloadBlob(
        new Blob([`\uFEFF${done.csv}`], { type: 'text/csv;charset=utf-8' }),
        `${fileSlug(teamName)}-audit-log-${day}.csv`,
      );
      if (done.capped) {
        toast.show(
          `Saved the newest ${done.rows.toLocaleString()} events. Narrow the dates to export the rest.`,
        );
      }
    } catch {
      toast.error('Couldn’t export the audit log. Try again.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Filter the audit log"
        className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,9rem)_minmax(0,9rem)]"
      >
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`${ids}-person`} className={FIELD_LABEL}>
            Person
          </label>
          <Select
            id={`${ids}-person`}
            className="w-full"
            selectClassName={FILTER_SELECT}
            value={filters.person}
            onChange={(e) => {
              const id = e.target.value;
              set({ person: id, personLabel: people.find((p) => p.id === id)?.label });
            }}
          >
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`${ids}-kind`} className={FIELD_LABEL}>
            Event
          </label>
          <Select
            id={`${ids}-kind`}
            className="w-full"
            selectClassName={FILTER_SELECT}
            value={filters.kind}
            onChange={(e) => {
              const kind = e.target.value;
              set({ kind: isTeamAuditEventType(kind) ? kind : '' });
            }}
          >
            <option value="">All Events</option>
            {AUDIT_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {TEAM_AUDIT_EVENT_LABELS[kind]}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${ids}-from`} className={FIELD_LABEL}>
            From
          </label>
          <DateInput
            id={`${ids}-from`}
            compact
            value={filters.from}
            onCommit={(day) => set({ from: day })}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${ids}-to`} className={FIELD_LABEL}>
            To
          </label>
          <DateInput
            id={`${ids}-to`}
            compact
            value={filters.to}
            onCommit={(day) => set({ to: day })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`m-0 text-xs ${MUTED}`} aria-live="polite">
          {log.loading || log.error
            ? ' '
            : log.events.length === 0
              ? 'No events'
              : `${log.events.length.toLocaleString()}${log.hasMore ? '+' : ''} ${
                  log.events.length === 1 ? 'event' : 'events'
                }${filtered ? ' match' : ''}`}
        </p>
        <div className="flex items-center gap-1.5">
          {filtered ? (
            <Button variant="ghost" size="xs" onClick={() => setFilters(NO_FILTERS)}>
              Clear Filters
            </Button>
          ) : null}
          {helpHref ? (
            <a
              href={helpHref}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Help: the audit log"
              title="Help"
              className="relative touch-target-y inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              ?
            </a>
          ) : null}
          <Button
            variant="secondary"
            size="xs"
            busy={exporting !== null}
            disabled={log.error !== null}
            title="Save every event these filters match as a CSV file"
            onClick={() => void exportCsv()}
          >
            {exporting === null
              ? 'Export CSV'
              : exporting > 0
                ? `Exporting… ${exporting.toLocaleString()}`
                : 'Exporting…'}
          </Button>
        </div>
      </div>

      {log.loading ? (
        <AuditSkeleton />
      ) : log.error === 'not_admin' ? (
        <EmptyState
          compact
          icon={<ShieldIcon size={28} />}
          title="Admins Only"
          description="Only the team’s admins can see its audit log."
        />
      ) : log.error ? (
        <EmptyState
          compact
          icon={<HistoryIcon size={28} />}
          title="Couldn’t load the audit log"
          description="Something went wrong reading it. Try again in a moment."
        >
          <Button variant="secondary" size="xs" onClick={log.retry}>
            Try again
          </Button>
        </EmptyState>
      ) : log.events.length === 0 ? (
        filtered ? (
          <EmptyState
            compact
            icon={<HistoryIcon size={28} />}
            title="No Events Match"
            description="Nothing in the last year matches these filters."
          >
            <Button variant="secondary" size="xs" onClick={() => setFilters(NO_FILTERS)}>
              Clear Filters
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            compact
            icon={<ShieldIcon size={28} />}
            title="No Audit Events Yet"
            description="Who joins or leaves, shares, moves or deletes the team’s documents, and the team’s webhooks show here for a year."
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <section key={day.key} aria-label={day.label} data-audit-day={day.key}>
              <h3
                className={`m-0 mb-1 px-1 text-xs font-semibold text-slate-600 dark:text-slate-300`}
              >
                {day.label}
              </h3>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-700/60 dark:border-slate-700">
                {day.events.map((event) => (
                  <AuditRow key={event.id} event={event} teamId={teamId} />
                ))}
              </ul>
            </section>
          ))}
          {log.moreFailed ? (
            <MoreFailed onRetry={log.loadMore} loading={log.loadingMore} />
          ) : log.hasMore ? (
            <div className="flex justify-center">
              <Button variant="secondary" size="xs" busy={log.loadingMore} onClick={log.loadMore}>
                {log.loadingMore ? 'Loading…' : 'Show More'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AuditRow({ event, teamId }: { event: TeamAuditEvent; teamId: string }) {
  const line = auditSentence(event, teamId);
  const detail = auditDetail(event);
  const at = new Date(event.occurredAt);
  const app = isApp(event.app) ? event.app : null;
  return (
    <li className="flex items-start gap-3 px-3 py-2.5" data-audit-event={event.id}>
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
      >
        {auditIcon(event.type)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm leading-snug text-slate-700 dark:text-slate-200">
          <bdi className="font-semibold text-slate-900 dark:text-slate-100">{line.who}</bdi>{' '}
          {line.action}
          {line.target ? (
            <>
              {' '}
              <bdi className="break-words font-medium text-slate-900 dark:text-slate-100">
                {line.target}
              </bdi>
            </>
          ) : null}
          {line.after ? ` ${line.after}` : null}
        </p>
        <p className={`m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs ${MUTED}`}>
          <span>{TEAM_AUDIT_EVENT_LABELS[event.type]}</span>
          {detail ? (
            <>
              <span aria-hidden>·</span>
              <bdi>{detail}</bdi>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            {app ? <AppMark app={app} size={12} /> : null}
            <span aria-hidden={app ? true : undefined}>
              {app ? siteOf(app).name : 'liveworkspace'}
            </span>
          </span>
        </p>
      </div>
      <time
        dateTime={at.toISOString()}
        title={`${at.toISOString().slice(0, 16).replace('T', ' ')} UTC`}
        className={`mt-0.5 shrink-0 text-xs tabular-nums ${MUTED}`}
      >
        {TIME.format(at)}
      </time>
    </li>
  );
}

function AuditSkeleton() {
  return (
    <ul
      aria-busy
      aria-label="Loading the audit log"
      data-audit-loading=""
      className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-700/60 dark:border-slate-700"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <span className={`h-7 w-7 shrink-0 rounded-full ${SKELETON}`} />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={`h-3.5 w-3/4 ${SKELETON}`} />
            <span className={`h-3 w-1/3 ${SKELETON}`} />
          </span>
          <span className={`h-3 w-10 ${SKELETON}`} />
        </li>
      ))}
    </ul>
  );
}

type Day = { key: string; label: string; events: TeamAuditEvent[] };

// Rows under the reader's day, newest first as they come.
function byDay(events: readonly TeamAuditEvent[]): Day[] {
  const days: Day[] = [];
  for (const event of events) {
    const at = new Date(event.occurredAt);
    const key = `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
    const last = days.at(-1);
    if (last?.key === key) last.events.push(event);
    else days.push({ key, label: MEDIUM_DATE.format(at), events: [event] });
  }
  return days;
}

type PersonOption = { id: string; label: string };

// The Person filter: the team's joined members by name, then anyone else the loaded rows name (a member who has
// left), so their rows can be singled out too. One pass over the loaded rows.
function usePeopleOptions(
  members: readonly TeamMember[],
  events: readonly TeamAuditEvent[],
  chosen: string,
  chosenLabel: string | undefined,
): PersonOption[] {
  return useMemo(() => {
    const joined = members
      .filter((m) => m.status === 'joined' && m.userId)
      .map((m) => ({ id: m.userId!, label: memberName(m, false) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const inTeam = new Set(joined.map((p) => p.id));
    const others = new Map<string, string>();
    for (const { actor } of events) {
      if (actor && actor.id !== 'deleted' && !inTeam.has(actor.id) && !others.has(actor.id)) {
        others.set(actor.id, `${personWords(actor)} (not in the team)`);
      }
    }
    const rest = [...others]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const options = [...joined, ...rest];
    if (chosen && !options.some((p) => p.id === chosen)) {
      options.push({ id: chosen, label: chosenLabel ?? 'Someone' });
    }
    return options;
  }, [members, events, chosen, chosenLabel]);
}
