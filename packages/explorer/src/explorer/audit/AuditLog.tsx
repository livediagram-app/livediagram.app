'use client';

// A team's Audit Log tab (liveworkspace/docs/specs/004-index/team-audit-log.md "The Audit Log on a team's page"):
// the team's admins alone see it. It is read when the tab opens: a note on what it records, the filters (Person,
// Event, From, To) with the count and Export CSV in one card, then the rows under day bands in another, newest
// first, a page at a time.

import { useId, useMemo, useState } from 'react';
import {
  isApp,
  TEAM_AUDIT_EVENT_LABELS,
  type TeamAuditEvent,
  type TeamAuditEventType,
  isTeamAuditEventType,
} from '@liveworkspace/index-client';
import { Button, DateInput, EmptyState, GlyphDisc, PictureDisc, Select } from '@liveworkspace/ui';
import { avatarFill } from '@liveworkspace/account-menu/initials';
import { initialsOf as personInitials } from '@liveworkspace/model-core/names';
import { downloadBlob } from '@liveworkspace/ui/download-blob';
import { MEDIUM_DATE, TIME } from '@liveworkspace/ui/date-format';
import type { TeamMember } from '../../data/teams';
import { memberName } from '../../teams/rules';
import { auditIcon, ShieldIcon } from '../../library/event-icons';
import { LIST_CARD, MUTED, SKELETON } from '../../ui/classes';
import { HistoryIcon } from '../../ui/library-icons';
import { useToast } from '../../ui/Toasts';
import { siteOf } from '../../words';
import { AppMark } from '../badges';
import { useExplorer } from '../context';
import { MoreFailed } from '../MoreFailed';
import {
  auditDetail,
  auditGroups,
  auditPill,
  auditSentence,
  dayRange,
  fileSlug,
  personWords,
} from './rows';
import { pickCsvSink } from './csv-sink';
import { exportAuditCsv, streamAuditCsv, useAuditLog, type AuditFilter } from './useAuditLog';

export const AUDIT_LOG_TITLE = 'Audit Log';

// The two selects at the date fields' height and 13px type, so the four filters line up in one row.
const FILTER_SELECT = 'h-[34px] text-[13px]';

/** The tab's body. Drawn only for a team admin; keyed on the team by its caller. */
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
  return (
    <div className="flex flex-col gap-4" data-audit-log={teamId}>
      <p className={`m-0 flex items-start gap-2 text-[13px] leading-normal ${MUTED}`}>
        <span className="mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden>
          <ShieldIcon size={14} />
        </span>
        <span>
          Only admins see the {AUDIT_LOG_TITLE}: who joined, left or changed role, what was shared,
          moved or deleted, and every approval and connection. Kept for a year.
        </span>
      </p>
      <AuditBody teamId={teamId} teamName={teamName} members={members} helpHref={helpHref} />
    </div>
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
  const { client, kind } = useExplorer();
  const groups = useMemo(() => auditGroups(kind.many), [kind.many]);
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
  const byUser = useMemo(
    () => new Map(members.flatMap((m) => (m.userId ? [[m.userId, m] as const] : []))),
    [members],
  );
  const [exporting, setExporting] = useState<number | null>(null);

  const set = (patch: Partial<Filters>) => setFilters((was) => ({ ...was, ...patch }));

  async function exportCsv() {
    if (exporting !== null) return;
    setExporting(0);
    const day = new Date().toISOString().slice(0, 10);
    const name = `${fileSlug(teamName)}-audit-log-${day}.csv`;
    // Where the browser has a save picker it opens here, inside the click, before any read; the file is then
    // written a chunk at a time instead of held whole.
    const picking = pickCsvSink(name);
    try {
      const choice = picking ? await picking : 'unsupported';
      if (choice === 'cancelled') return;
      let done: { rows: number; capped: boolean };
      if (choice === 'unsupported') {
        const all = await exportAuditCsv(client, query, setExporting);
        downloadBlob(new Blob(['﻿', all.csv], { type: 'text/csv;charset=utf-8' }), name);
        done = all;
      } else {
        try {
          await choice.write('﻿');
          done = await streamAuditCsv(client, query, choice.write, setExporting);
          await choice.close();
        } catch (e) {
          await choice.abort();
          throw e;
        }
      }
      if (done.capped) {
        toast.show(
          `Saved the newest ${done.rows.toLocaleString()} audit events. Narrow the dates to export the rest.`,
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
      <div className={`${LIST_CARD} flex flex-col gap-3 p-4`}>
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
              {groups.map((group) => (
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
              disabled={log.error !== null || (!log.loading && log.events.length === 0)}
              title={
                !log.loading && log.error === null && log.events.length === 0
                  ? 'Nothing to export'
                  : 'Save every event these filters match as a CSV file'
              }
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
            title="No events match"
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
            title="No audit events yet"
            description="Who joins or leaves, shares, moves or deletes the team’s documents, and the team’s connections show here for a year."
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <div className={LIST_CARD}>
            {days.map((day) => (
              <section key={day.key} aria-label={day.label} data-audit-day={day.key}>
                <h3 className="m-0 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300">
                  {day.label}
                </h3>
                <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-700/60 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-slate-100 dark:[&:not(:last-child)]:border-slate-700/60">
                  {day.events.map((event) => (
                    <AuditRow
                      key={event.id}
                      event={event}
                      teamId={teamId}
                      person={event.actor ? byUser.get(event.actor.id) : undefined}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {log.moreFailed ? (
            <MoreFailed onRetry={log.loadMore} loading={log.loadingMore} />
          ) : log.hasMore ? (
            <div className="flex justify-center">
              <Button variant="secondary" size="xs" busy={log.loadingMore} onClick={log.loadMore}>
                {log.loadingMore ? 'Loading…' : 'Show Older Events'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AuditRow({
  event,
  teamId,
  person,
}: {
  event: TeamAuditEvent;
  teamId: string;
  /** The actor as a member of the team, for their picture and colour. */
  person?: TeamMember;
}) {
  const line = auditSentence(event, teamId);
  const detail = auditDetail(event);
  const at = new Date(event.occurredAt);
  const app = isApp(event.app) ? event.app : null;
  const who = personWords(event.actor);
  const pill = auditPill(event.type);
  return (
    <li className="flex items-start gap-3 px-4 py-3" data-audit-event={event.id}>
      {event.actor && event.actor.id !== 'deleted' ? (
        <PictureDisc
          aria-hidden
          pictureUrl={person?.picture ?? null}
          name={who}
          size={30}
          style={{ backgroundColor: avatarFill(who, person?.color) }}
          className="mt-0.5 flex shrink-0 text-[11px] font-semibold text-white"
        >
          {personInitials(who, null)}
        </PictureDisc>
      ) : (
        <GlyphDisc
          aria-hidden
          size={30}
          className="mt-0.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
        >
          {auditIcon(event.type)}
        </GlyphDisc>
      )}
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
        <p className={`m-0 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs ${MUTED}`}>
          <span
            data-audit-pill={pill}
            className="rounded-full bg-slate-100 px-2 py-px text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600"
            title={TEAM_AUDIT_EVENT_LABELS[event.type]}
          >
            <span className="text-optical-line">{pill}</span>
          </span>
          {detail ? <bdi>{detail}</bdi> : null}
          {detail ? <span aria-hidden>·</span> : null}
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
