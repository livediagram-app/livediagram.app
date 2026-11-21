'use client';

// Someone Arrived's and Everyone Left's panels (docs/specs/013-workspace/automations.md "Triggers of its own", "The
// screen"; blueprint automations.md "Editor", "The kit"), built from the platform's panel parts so they sit beside
// the shared triggers' as one family. Each reads one tab, a room as Tab Attendance counts it, or every tab each on its
// own; Someone Arrived keeps to the first person into an empty room unless told otherwise, and Everyone Left waits a
// while you choose, shown as a duration. Loaded with the screen.

import {
  EVERYONE_LEFT_MINUTES_MAX,
  EVERYONE_LEFT_MINUTES_MIN,
  type EveryoneLeftTrigger,
  type SomeoneArrivedTrigger,
} from '@livehuddle/document/automations';
import { quietWords } from '@liveworkspace/automations/item';
import { SwitchRow } from '@liveworkspace/ui';
import type { TriggerPanelProps } from '@liveworkspace/automations-ui/kit';
import { TabSelect, withTab, type ItemUiOutline } from '@liveworkspace/automations-ui/item';
import { PanelField, PanelSelect } from '@liveworkspace/automations-ui/step-panels/panel-parts';

type Props<Trigger> = TriggerPanelProps<Trigger, ItemUiOutline>;

/** How long Everyone Left may wait, as its select offers: a minute to twelve hours. */
export const EVERYONE_LEFT_PRESETS: readonly number[] = [1, 5, 10, 15, 30, 60, 120, 240, 720];

const ROOM_HINT =
  'A tab is a room, as its Attendance counts it: one room alone, or each room on its own.';

/** The minutes a rule holds, kept inside Everyone Left's range (10, the default, for no number at all). */
export function leftMinutes(raw: unknown): number {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || raw === '' || raw === null || raw === undefined) return 10;
  return Math.min(EVERYONE_LEFT_MINUTES_MAX, Math.max(EVERYONE_LEFT_MINUTES_MIN, n));
}

export function SomeoneArrivedPanel({ trigger, onChange, outline }: Props<SomeoneArrivedTrigger>) {
  const empty = trigger.empty !== false;
  return (
    <>
      <TabSelect
        label="In"
        any="Any Tab"
        value={trigger.tab ?? ''}
        tabs={outline.item.tabs}
        hint={ROOM_HINT}
        onChange={(tab) => onChange(withTab(trigger, tab))}
      />
      <SwitchRow
        checked={empty}
        onChange={(next) => onChange({ ...trigger, empty: next })}
        layout="flex items-start justify-between gap-3 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
            Only When It Was Empty
          </span>
          <span className="text-[12px] text-slate-500 dark:text-slate-400">
            {empty
              ? 'Starts for the first person into an empty room, not for those who follow.'
              : 'Starts for everyone who comes in.'}{' '}
            Someone back within two minutes starts nothing.
          </span>
        </span>
      </SwitchRow>
    </>
  );
}

export function EveryoneLeftPanel({ trigger, onChange, outline }: Props<EveryoneLeftTrigger>) {
  // A figure an agent or a file set (within the range, off the list) stays as its own choice.
  const minutes = leftMinutes(trigger.minutes);
  const choices = EVERYONE_LEFT_PRESETS.includes(minutes)
    ? EVERYONE_LEFT_PRESETS
    : [...EVERYONE_LEFT_PRESETS, minutes].sort((a, b) => a - b);
  return (
    <>
      <PanelField
        label="After"
        hint="How long the room must stay empty once the last person leaves. Someone back in that time starts it over, so a dropped connection or a short break starts nothing."
      >
        {(id, hintId) => (
          <PanelSelect
            id={id}
            aria-describedby={hintId}
            value={String(minutes)}
            onChange={(e) => onChange({ ...trigger, minutes: Number(e.target.value) })}
          >
            {choices.map((m) => (
              <option key={m} value={m}>
                {quietWords(m).toLowerCase()}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      <TabSelect
        label="In"
        any="Any Tab"
        value={trigger.tab ?? ''}
        tabs={outline.item.tabs}
        hint={ROOM_HINT}
        onChange={(tab) => onChange(withTab(trigger, tab))}
      />
    </>
  );
}
