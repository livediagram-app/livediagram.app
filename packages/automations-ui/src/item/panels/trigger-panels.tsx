'use client';

// The shared triggers' panels (blueprint item-ui.md "Panels"; automations.md "Triggers every app has"): how long
// Edited, Then Quiet waits and on which tab, Not Edited For's days and time, the comment triggers' tab, an Incoming
// Webhook whose example names one of the item's tabs, and for a trigger with nothing to set a line saying when it
// starts.

import {
  EDITED_MINUTES_MAX,
  EDITED_MINUTES_MIN,
  NOT_EDITED_DAYS_MAX,
  quietWords,
  type ItemEdited,
  type ItemNotEdited,
  type ItemPart,
  type ItemTabTrigger,
} from '@liveworkspace/automations/item';
import type { ComponentType } from 'react';
import { TextInput } from '@liveworkspace/ui';
import type { TriggerPanelProps } from '../../kit';
import { IncomingWebhookPanel } from '../../step-panels/IncomingWebhookPanel';
import { PanelField, PanelNote, PanelSelect } from '../../step-panels/panel-parts';
import { AtField, TimeZoneNote } from '../../step-panels/ScheduledPanel';
import type { ItemUiOutline } from '../types';
import { TabSelect, withTab } from './panel-bits';

type Props<Trigger> = TriggerPanelProps<Trigger, ItemUiOutline>;

/** How long Edited, Then Quiet may wait, as its select offers. */
export const QUIET_PRESETS: readonly number[] = [5, 15, 30, 60, 240, 1440];

const quietLabel = (minutes: number) => quietWords(minutes).toLowerCase();

/** A whole number a field typed, kept inside its range (`fallback` for no number at all). */
export function wholeWithin(raw: string, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && raw.trim() !== '' ? Math.min(max, Math.max(min, n)) : fallback;
}

export function EditedPanel({ trigger, onChange, outline }: Props<ItemEdited>) {
  // A figure an agent or a file set (within the range, off the list) stays as its own choice.
  const minutes = wholeWithin(String(trigger.minutes), EDITED_MINUTES_MIN, EDITED_MINUTES_MAX, 30);
  const choices = QUIET_PRESETS.includes(minutes)
    ? QUIET_PRESETS
    : [...QUIET_PRESETS, minutes].sort((a, b) => a - b);
  return (
    <>
      <PanelField
        label="After"
        hint="How long nothing must change before the rule starts. It starts once per burst of edits, never per keystroke."
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
                {quietLabel(m)}
              </option>
            ))}
          </PanelSelect>
        )}
      </PanelField>
      <TabSelect
        label="On"
        any="Any Tab"
        value={trigger.tab ?? ''}
        tabs={outline.item.tabs}
        hint="One tab’s edits alone, or any tab’s."
        onChange={(tab) => onChange(withTab(trigger, tab))}
      />
    </>
  );
}

export function NotEditedPanel({ trigger, onChange, timeZone }: Props<ItemNotEdited>) {
  return (
    <>
      <PanelField
        label="Days"
        hint={`1 to ${NOT_EDITED_DAYS_MAX}. It starts once each time it goes this long untouched, not daily while it stays untouched.`}
      >
        {(id, hintId) => (
          <TextInput
            compact
            id={id}
            hintId={hintId}
            type="number"
            inputMode="numeric"
            step={1}
            min={1}
            max={NOT_EDITED_DAYS_MAX}
            value={trigger.days}
            onChange={(e) =>
              onChange({
                ...trigger,
                days: wholeWithin(e.target.value, 1, NOT_EDITED_DAYS_MAX, 1),
              })
            }
            className="w-28"
          />
        )}
      </PanelField>
      <AtField at={trigger.at} onChange={(at) => onChange({ ...trigger, at })} />
      <TimeZoneNote timeZone={timeZone} tail=". Checked daily at this time." />
    </>
  );
}

/** A trigger that may be kept to one tab: Comment Added, Thread Resolved, All Threads Resolved. */
export function TabTriggerPanel({ trigger, onChange, outline }: Props<ItemTabTrigger>) {
  return (
    <TabSelect
      label="On"
      any="Any Tab"
      value={trigger.tab ?? ''}
      tabs={outline.item.tabs}
      hint="One tab alone, or any tab."
      onChange={(tab) => onChange(withTab(trigger, tab))}
    />
  );
}

/** The panel of a trigger with nothing to set: when it starts, in a line. */
export function startsWhenPanel(text: string): ComponentType<Props<ItemPart>> {
  return function StartsWhenPanel() {
    return <PanelNote>{text}</PanelNote>;
  };
}

/** The example body How to Send posts: the item's first tab by name, and a field of the caller's own. A name the
 *  example's shell quoting could not carry is left out. */
export function incomingExample(tabs: readonly { name: string }[]): string {
  const name = tabs[0]?.name;
  return name && !/['\\]/.test(name)
    ? `{"tab": ${JSON.stringify(name)}, "status": "green"}`
    : '{"status": "green"}';
}

export function ItemIncomingPanel({ outline }: Props<ItemPart>) {
  return <IncomingWebhookPanel example={incomingExample(outline.item.tabs)} />;
}
