'use client';

// Set Up Refinement, Sprint Planning and Bug Triage (docs/specs/026-plan/session-tabs.md "Making one", "Sprint
// Planning", "Bug Triage"): a centred dialog with an illustrated header in parts: Card Types, Stages (Bug Triage's
// Intake Stages, with each one's cards counted), Order (a board's Sort Cards choices), When Refined, Committed or
// Accepted (per type: Next Stage or one of its stages), a kind with a closing outcome's When Closed (per type: Close
// Stage or one of its stages), a kind with a tally's Capacity (planning/CapacityPart) and Timebox. It previews the queue as it fills. Start Session makes the tab a
// Session tab; opened from Session Settings it saves the set-up in place.
import { useId, useMemo, useState } from 'react';
import {
  BOARD_SORT_DIRS,
  boardSortFieldsOf,
  boardSortLabel,
  sessionQueue,
  typeStatusesOf,
  withBoardSortPick,
  type BoardSortLevel,
  type SessionKindId,
} from '@liveplanner/items';
import {
  SESSION_KINDS,
  SESSION_TIMEBOX_MAX_MS,
  SESSION_TIMEBOX_MIN_MS,
  type SessionSetup,
} from '@liveplanner/project';
import { Select, ToolFooter, ToolFooterButton } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { ChoicePills } from '@/components/primitives/ChoicePills';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { cardsWord, stageCounts, stagesFor } from './session-setup';
import { SESSION_KIND_LOOKS } from './session-kinds';
import { sessionHeroArt } from './SessionHeroArt';
import { CapacityPart, NoEstimateNote } from './planning/CapacityPart';
import { ReviewSetupParts } from './review/ReviewSetupParts';

const MINUTE = 60_000;
const TIMEBOX_CHIPS = [2, 3, 5, 10] as const;
const NEXT = '';
const NONE = '';
const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const HINT = 'text-[12px] text-slate-500 dark:text-slate-400';

export function SessionSetupDialog({
  sessionKind,
  initial,
  plan,
  settings,
  lastReviewAt = null,
  onDone,
  onClose,
}: {
  sessionKind: SessionKindId;
  initial: SessionSetup;
  plan: Pick<PlanContextValue, 'items' | 'types' | 'statusNames'>;
  // Opened from Session Settings: saves in place rather than starting.
  settings: boolean;
  // Sprint Review: when another review session last decided a card (its Since Last Review chip), or null.
  lastReviewAt?: number | null;
  onDone: (setup: SessionSetup) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const look = SESSION_KIND_LOOKS[sessionKind];
  const tallies = SESSION_KINDS[sessionKind].tally === 'estimate';
  const closes = !!SESSION_KINDS[sessionKind].closes;
  // Sprint Review: Reviewed moves nothing (no When part), and it reads finished work in a done range.
  const stays = !!SESSION_KINDS[sessionKind].stays;
  const archived = !!SESSION_KINDS[sessionKind].archived;
  const { items, types, statusNames } = plan;
  const planStatuses = useMemo(() => [...statusNames.keys()], [statusNames]);
  const [setup, setSetup] = useState<SessionSetup>(initial);
  const picked = types.filter((t) => setup.typeIds.includes(t.id));
  const stages = stagesFor(setup.typeIds, types, planStatuses);
  const counts = useMemo(
    () => stageCounts(items.values(), setup.typeIds, archived),
    [items, setup.typeIds, archived],
  );
  const nameOf = (s: string) => statusNames.get(s) ?? s;
  const queue = useMemo(
    () => sessionQueue({ items: items.values(), types, pick: { ...setup, archived } }),
    [items, types, setup, archived],
  );
  const fields = boardSortFieldsOf(picked);
  const [first, second] = setup.sortBy ?? [];
  const sortPick = (level: 0 | 1, field: string) =>
    setSetup((s) => {
      const sortBy = withBoardSortPick(s.sortBy, level, {
        field: field === NONE ? null : field,
        kind: fields.find((f) => f.id === field)?.kind,
      });
      return withSort(s, sortBy);
    });
  const dirPick = (level: 0 | 1, dir: 'asc' | 'desc') =>
    setSetup((s) => withSort(s, withBoardSortPick(s.sortBy, level, { dir })));
  const toggle = (list: readonly string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  const pickType = (id: string) =>
    setSetup((s) => {
      const typeIds = toggle(s.typeIds, id);
      // A stage no picked type uses any more leaves the set-up with it.
      const offered = new Set(stagesFor(typeIds, types, planStatuses));
      return { ...s, typeIds, statuses: s.statuses.filter((x) => offered.has(x)) };
    });
  const minutes = setup.timeboxMs ? Math.round(setup.timeboxMs / MINUTE) : 0;
  const ready = setup.typeIds.length > 0 && setup.statuses.length > 0;
  const sortWords = first
    ? `, ${fields.find((f) => f.id === first.field)?.label ?? first.field} ${boardSortLabel(fields.find((f) => f.id === first.field)?.kind, first.dir).toLowerCase()}`
    : ', in board order';
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="lg" phoneSheet>
      <HeroDialogHeader
        art={sessionHeroArt}
        titleId={titleId}
        title={settings ? 'Session Settings' : look.setupTitle}
        subtitle={look.setupLine}
        onClose={onClose}
      />
      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <section className="flex flex-col gap-2" aria-labelledby={`${titleId}-types`}>
          <h3 id={`${titleId}-types`} className={HEADING}>
            Card Types
          </h3>
          {types.length ? null : (
            <p className={HINT}>
              This plan has no card types yet. Add a board with cards first, then refine them here.
            </p>
          )}
          <ChoicePills
            label="Card types"
            data="session-types"
            pills={types.map((t) => ({
              id: t.id,
              label: t.label,
              icon: <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} />,
            }))}
            pressed={(id) => setup.typeIds.includes(id)}
            onPick={pickType}
          />
          {tallies ? <NoEstimateNote picked={picked} /> : null}
        </section>
        <section className="flex flex-col gap-2" aria-labelledby={`${titleId}-stages`}>
          <h3 id={`${titleId}-stages`} className={HEADING}>
            {look.stagesHeading}
          </h3>
          {stages.length ? (
            <ChoicePills
              label="Stages"
              data="session-stages"
              pills={stages.map((s) => ({
                id: s,
                label: nameOf(s),
                aside: (
                  <span className="ml-0.5 tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                    {counts.get(s) ?? 0}
                  </span>
                ),
              }))}
              pressed={(id) => setup.statuses.includes(id)}
              onPick={(id) => setSetup((s) => ({ ...s, statuses: toggle(s.statuses, id) }))}
            />
          ) : (
            <p className={HINT}>Pick a card type to see its stages.</p>
          )}
        </section>
        <section className="flex flex-col gap-2" aria-labelledby={`${titleId}-order`}>
          <h3 id={`${titleId}-order`} className={HEADING}>
            Order
          </h3>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 max-sm:grid-cols-[auto_1fr]">
            <SortRow
              label="Sort By"
              level={first}
              fields={fields}
              onField={(f) => sortPick(0, f)}
              onDir={(d) => dirPick(0, d)}
            />
            {first ? (
              <SortRow
                label="Then By"
                level={second}
                fields={fields.filter((f) => f.id !== first.field)}
                onField={(f) => sortPick(1, f)}
                onDir={(d) => dirPick(1, d)}
              />
            ) : null}
          </div>
        </section>
        {archived ? (
          <ReviewSetupParts
            id={titleId}
            setup={setup}
            lastReviewAt={lastReviewAt}
            onChange={setSetup}
          />
        ) : null}
        {picked.length && !stays ? (
          <section className="flex flex-col gap-2" aria-labelledby={`${titleId}-target`}>
            <h3 id={`${titleId}-target`} className={HEADING}>
              {look.targetHeading}
            </h3>
            <div className="grid grid-cols-[minmax(0,auto)_auto_1fr] items-center gap-x-3 gap-y-2">
              {picked.map((t) => (
                <TargetRow
                  key={t.id}
                  label={t.label}
                  colour={t.color}
                  stages={typeStatusesOf(t, planStatuses)}
                  nameOf={nameOf}
                  value={setup.targets?.[t.id] ?? NEXT}
                  onPick={(stage) => setSetup((s) => withTarget(s, t.id, stage))}
                />
              ))}
            </div>
          </section>
        ) : null}
        {picked.length && closes ? (
          <section className="flex flex-col gap-2" aria-labelledby={`${titleId}-close`}>
            <h3 id={`${titleId}-close`} className={HEADING}>
              {look.closeHeading}
            </h3>
            <div className="grid grid-cols-[minmax(0,auto)_auto_1fr] items-center gap-x-3 gap-y-2">
              {picked.map((t) => (
                <TargetRow
                  key={t.id}
                  label={t.label}
                  colour={t.color}
                  stages={typeStatusesOf(t, planStatuses)}
                  nameOf={nameOf}
                  value={setup.closeTargets?.[t.id] ?? NEXT}
                  first="Close Stage"
                  closing
                  onPick={(stage) => setSetup((s) => withTarget(s, t.id, stage, 'closeTargets'))}
                />
              ))}
            </div>
          </section>
        ) : null}
        {tallies ? (
          <CapacityPart
            id={titleId}
            capacity={setup.capacity}
            onChange={(capacity) => setSetup((s) => withCapacity(s, capacity))}
          />
        ) : null}
        <section className="flex flex-col gap-2" aria-labelledby={`${titleId}-timebox`}>
          <h3 id={`${titleId}-timebox`} className={HEADING}>
            Timebox
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <ChoicePills
              label="Timebox per card"
              data="session-timebox"
              pills={[
                { id: '0', label: 'Off' },
                ...TIMEBOX_CHIPS.map((m) => ({ id: String(m), label: `${m} min` })),
              ]}
              pressed={(id) => Number(id) === minutes}
              onPick={(id) => setSetup((s) => withTimebox(s, Number(id)))}
            />
            <label className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
              <input
                type="number"
                min={SESSION_TIMEBOX_MIN_MS / MINUTE}
                max={SESSION_TIMEBOX_MAX_MS / MINUTE}
                value={minutes || ''}
                placeholder="Other"
                onChange={(e) => setSetup((s) => withTimebox(s, Number(e.target.value)))}
                className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-[13px] tabular-nums dark:border-slate-700 dark:bg-slate-900"
              />
              min per card
            </label>
          </div>
        </section>
      </div>
      <ToolFooter>
        <p className={`${HINT} mr-auto self-center`} role="status" data-session-preview="">
          {ready
            ? `${cardsWord(queue.toGo.length)}${queue.capped ? ' (the first ones)' : ''}${sortWords}`
            : 'Pick at least one card type and one stage'}
        </p>
        <ToolFooterButton disabled={!ready} onClick={() => onDone(setup)}>
          {settings ? 'Save' : 'Start Session'}
        </ToolFooterButton>
      </ToolFooter>
    </Dialog>
  );
}

function withSort(s: SessionSetup, sortBy: BoardSortLevel[]): SessionSetup {
  const { sortBy: _was, ...rest } = s;
  return sortBy.length ? { ...rest, sortBy } : rest;
}

// One type's target named (or back to its default) in `key`: where the completing outcome, or the closing one, moves
// its cards.
function withTarget(
  s: SessionSetup,
  typeId: string,
  stage: string,
  key: 'targets' | 'closeTargets' = 'targets',
): SessionSetup {
  const { [typeId]: _was, ...others } = s[key] ?? {};
  const targets = stage === NEXT ? others : { ...others, [typeId]: stage };
  const { [key]: _t, ...rest } = s;
  return Object.keys(targets).length ? { ...rest, [key]: targets } : rest;
}

function withCapacity(s: SessionSetup, capacity: number | undefined): SessionSetup {
  const { capacity: _was, ...rest } = s;
  return capacity ? { ...rest, capacity } : rest;
}

function withTimebox(s: SessionSetup, minutes: number): SessionSetup {
  const { timeboxMs: _was, ...rest } = s;
  // Off, a cleared field or anything not a number.
  if (!(minutes > 0)) return rest;
  const ms = Math.min(SESSION_TIMEBOX_MAX_MS, Math.max(SESSION_TIMEBOX_MIN_MS, minutes * MINUTE));
  return { ...rest, timeboxMs: ms };
}

function SortRow({
  label,
  level,
  fields,
  onField,
  onDir,
}: {
  label: string;
  level: BoardSortLevel | undefined;
  fields: readonly { id: string; label: string; kind: Parameters<typeof boardSortLabel>[0] }[];
  onField: (field: string) => void;
  onDir: (dir: 'asc' | 'desc') => void;
}) {
  const kind = fields.find((f) => f.id === level?.field)?.kind;
  return (
    <>
      <span className="text-[13px] text-slate-600 dark:text-slate-300">{label}</span>
      <Select
        aria-label={label}
        value={level?.field ?? NONE}
        onChange={(e) => onField(e.target.value)}
        selectClassName="text-[13px]"
      >
        <option value={NONE}>None (board order)</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </Select>
      {level ? (
        <Select
          aria-label={`${label} direction`}
          value={level.dir}
          onChange={(e) => onDir(e.target.value as 'asc' | 'desc')}
          selectClassName="text-[13px]"
          className="max-sm:col-start-2"
        >
          {BOARD_SORT_DIRS.map((d) => (
            <option key={d} value={d}>
              {boardSortLabel(kind, d)}
            </option>
          ))}
        </Select>
      ) : (
        <span className="max-sm:hidden" />
      )}
    </>
  );
}

function TargetRow({
  label,
  colour,
  stages,
  nameOf,
  value,
  first = 'Next Stage',
  closing = false,
  onPick,
}: {
  label: string;
  colour: string;
  stages: readonly string[];
  nameOf: (s: string) => string;
  value: string;
  // The default choice's name: Next Stage, or a closing outcome's Close Stage.
  first?: string;
  // Where a closing outcome moves the type's cards, so its picker is named apart.
  closing?: boolean;
  onPick: (stage: string) => void;
}) {
  return (
    <>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colour }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[13px] text-slate-500 dark:text-slate-400">Moves to</span>
      <Select
        aria-label={`${label} cards move to${closing ? ' when closed' : ''}`}
        value={value}
        onChange={(e) => onPick(e.target.value)}
        selectClassName="text-[13px]"
      >
        <option value={NEXT}>{first}</option>
        {stages.map((s) => (
          <option key={s} value={s}>
            {nameOf(s)}
          </option>
        ))}
      </Select>
    </>
  );
}
