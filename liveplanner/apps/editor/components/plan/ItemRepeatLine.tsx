'use client';

// A repeating card in the item panel (docs/specs/026-plan/items.md "Repeating cards"): the Details column's line
// naming the rule and its next day, with Edit and Stop for an Editor, and the ⋯ menu's Repeat rows, which open the
// Repeat dialog. useItemRepeat holds the dialog and hands the panel the three parts.
import { useState, type ReactNode } from 'react';
import {
  REPEAT_FIELD,
  dayWords,
  itemRepeat,
  localDay,
  repeatNext,
  repeatRuleWords,
  typeStatusesOf,
  type Item,
  type ItemFieldValue,
  type ItemTypeDef,
  type RepeatRule,
} from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { usePlan } from './PlanContext';
import { PlanTypeGlyph } from './plan-type-glyph';
import { RepeatDialog } from './RepeatDialog';

// The browser's own time zone: the setter's, stamped on every save.
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const LINK =
  'cursor-pointer rounded px-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-800 dark:text-brand-300 dark:hover:bg-brand-500/10';

export function ItemRepeatLine({
  rule,
  now,
  offline,
  onEdit,
  onStop,
}: {
  rule: RepeatRule;
  now: number;
  // A plan in This Browser makes no copies: the line says so instead of a next day.
  offline: boolean;
  // An Editor's Edit and Stop; absent, the line alone.
  onEdit?: (() => void) | undefined;
  onStop?: (() => void) | undefined;
}) {
  const next = offline ? null : repeatNext(rule, now);
  const thisYear = Number(localDay(now, rule.timeZone).slice(0, 4));
  return (
    <section
      aria-label="Repeat"
      data-item-repeat=""
      className="mt-3 flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-[12px] text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-900/40 dark:text-slate-300 dark:ring-slate-700/70"
    >
      <span className="mt-0.5 shrink-0 text-slate-500 dark:text-slate-400">
        <PlanTypeGlyph glyph="repeat" size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <p>Repeats {repeatRuleWords(rule)}</p>
        <p className="text-slate-500 dark:text-slate-400">
          {offline
            ? 'Repeats only in plans saved to your account'
            : next
              ? `Next ${dayWords(next, thisYear)}`
              : 'Ended'}
        </p>
      </div>
      {onEdit || onStop ? (
        <div className="-mr-1 flex shrink-0 items-center">
          {onEdit ? (
            <button type="button" className={LINK} onClick={onEdit}>
              Edit
            </button>
          ) : null}
          {onStop ? (
            <button type="button" className={LINK} onClick={onStop}>
              Stop
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export interface ItemRepeatParts {
  // The ⋯ menu's rows: absent for anyone but an Editor on a plan in an account.
  menu: { repeating: boolean; onRepeat: () => void; onStopRepeat: () => void } | null;
  // The Details line, on a repeating card.
  line: ReactNode;
  // The open dialog.
  dialog: ReactNode;
}

export function useItemRepeat({
  item,
  type,
  statuses,
  canSet,
  now,
  onSave,
}: {
  item: Item;
  // The card's type: a copy is of the same type, so Lands In offers only the states it uses (item-types.md "The
  // statuses a type uses"), as the Status picker does.
  type: Pick<ItemTypeDef, 'statuses' | 'excludedStatuses'>;
  statuses: readonly { status: string; name: string }[];
  // An Editor's (canRetire).
  canSet: boolean;
  now: number;
  onSave: (field: string, value: ItemFieldValue | undefined) => void | Promise<boolean>;
}): ItemRepeatParts {
  // The setter's day the dialog opened on (its `from`), or null while it is shut.
  const [openDay, setOpenDay] = useState<string | null>(null);
  const plan = usePlan();
  const offline = useIsOfflineProject(plan?.itemsScope?.projectId ?? null);
  const rule = itemRepeat(item);
  const may = canSet && !offline;
  const timeZone = browserTimeZone();
  const byId = new Map(statuses.map((s) => [s.status, s]));
  const landIn = typeStatusesOf(type, byId.keys()).flatMap((id) => {
    const s = byId.get(id);
    return s ? [s] : [];
  });
  const stop = () => {
    setOpenDay(null);
    track('Plan', 'Toggled', 'RepeatOff');
    void onSave(REPEAT_FIELD, undefined);
  };
  const edit = () => setOpenDay(localDay(Date.now(), timeZone));
  return {
    menu: may ? { repeating: !!rule, onRepeat: edit, onStopRepeat: stop } : null,
    line: rule ? (
      <ItemRepeatLine
        rule={rule}
        now={now}
        offline={offline}
        {...(may ? { onEdit: edit, onStop: stop } : {})}
      />
    ) : null,
    dialog:
      openDay !== null && may ? (
        <RepeatDialog
          rule={rule}
          statuses={landIn}
          today={openDay}
          timeZone={timeZone}
          onClose={() => setOpenDay(null)}
          onStop={stop}
          onSave={(next) => {
            setOpenDay(null);
            if (!rule) track('Plan', 'Toggled', 'RepeatOn');
            void onSave(REPEAT_FIELD, next as unknown as ItemFieldValue);
          }}
        />
      ) : null,
  };
}
