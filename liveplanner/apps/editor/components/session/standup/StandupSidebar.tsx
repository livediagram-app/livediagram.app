'use client';

// Stand-up's queue (docs/specs/026-plan/session-tabs.md "Stand-up", "The sidebar"): one row per person in the people
// order (their disc, name, card count, and a tick once Done), the room's person unfolded to their cards; anyone may
// unfold or fold another person on their own screen. Each card is every kind's SessionRow with its stage's name, and
// Up and Down walk the cards across people.
import { useState } from 'react';
import { itemStatus, typeIn, type ItemTypeDef, type StandupPerson } from '@liveplanner/items';
import type { SessionDecision } from '@liveplanner/project';
import { lucideCheck, lucideChevronRight } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';
import { cardRefIn } from '@/components/plan/card-ref';
import { PersonDisc } from '@/components/plan/PersonDisc';
import { SessionRow, useRowKeys } from '../SessionSidebar';
import { personName } from './standup-words';

const TickIcon = lucideGlyph(lucideCheck, 14);
const ChevronIcon = lucideGlyph(lucideChevronRight, 14);

export function StandupSidebar({
  label,
  people,
  types,
  statusNames,
  decided,
  isDone,
  currentId,
  currentKey,
  shownId,
  onOpen,
}: {
  label: string;
  people: readonly StandupPerson[];
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
  decided: Readonly<Record<string, SessionDecision>> | undefined;
  isDone: (key: string) => boolean;
  // The room's card and its person, and the card this screen shows.
  currentId: string | null;
  currentKey: string | null;
  shownId: string | null;
  onOpen: (itemId: string) => void;
}) {
  const refOf = cardRefIn(types);
  const { listRef, onKey } = useRowKeys(onOpen);
  // This screen's own folds, over the default (the room's person unfolded, everyone else folded), kept with the
  // person the room was on: the room moving to a person unfolds them again.
  const [folds, setFolds] = useState<{
    room: string | null;
    map: Readonly<Record<string, boolean>>;
  }>({ room: null, map: {} });
  const open = (key: string) =>
    key === currentKey && folds.room !== currentKey ? true : (folds.map[key] ?? key === currentKey);
  const toggle = (key: string) =>
    setFolds((f) => ({ room: currentKey, map: { ...f.map, [key]: !open(key) } }));
  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={`${label} queue`}
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3"
    >
      {people.map((p) => {
        const name = personName(p.person);
        const done = isDone(p.key);
        const here = p.key === currentKey;
        const unfolded = open(p.key);
        const count = `${p.cards.length} ${p.cards.length === 1 ? 'card' : 'cards'}`;
        return (
          <li
            key={p.key}
            role="group"
            aria-label={`${name}, ${count}${done ? ', done' : ''}`}
            data-standup-person={p.key}
            className={`rounded-lg border ${here ? 'border-brand-300 bg-brand-50/70 dark:border-brand-700 dark:bg-brand-950/30' : 'border-transparent'}`}
          >
            <button
              type="button"
              aria-expanded={unfolded}
              onClick={() => toggle(p.key)}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800/50 ${done && !here ? 'opacity-60' : ''}`}
            >
              {p.person ? (
                <PersonDisc person={p.person} />
              ) : (
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-400 text-[10px] font-semibold text-slate-500 dark:border-slate-500 dark:text-slate-400"
                >
                  <span className="text-optical-centre">?</span>
                </span>
              )}
              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${here ? 'font-semibold text-slate-900 dark:text-slate-50' : 'font-medium text-slate-800 dark:text-slate-100'}`}
              >
                {name}
              </span>
              {done ? (
                <span className="shrink-0 text-brand-700 dark:text-brand-400" data-person-done="">
                  <TickIcon aria-hidden />
                  <span className="sr-only">Done</span>
                </span>
              ) : null}
              <span className="shrink-0 text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
                {p.cards.length}
              </span>
              <span
                aria-hidden
                className={`shrink-0 text-slate-400 transition-transform motion-reduce:transition-none ${unfolded ? 'rotate-90' : ''}`}
              >
                <ChevronIcon />
              </span>
            </button>
            {unfolded ? (
              <ul className="flex flex-col gap-1 px-1.5 pb-1.5">
                {p.cards.map((item, at) => {
                  const stage = itemStatus(item) ?? '';
                  return (
                    <SessionRow
                      key={`${p.key}:${item.id}`}
                      item={item}
                      place={at + 1}
                      refText={refOf(item)}
                      sub={statusNames.get(stage) ?? stage}
                      colour={typeIn(types, item.type).color}
                      outcome={decided?.[item.id]?.outcome}
                      isCurrent={item.id === currentId}
                      isShown={item.id === shownId}
                      onOpen={onOpen}
                      onKey={onKey}
                    />
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
