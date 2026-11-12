'use client';

// Wait (docs/specs/026-plan/automations.md "Wait"): how long the rest of the rule holds, in days and hours, from 1 hour
// to 30 days. When the time is up the card is read again and the rule's conditions checked again.

import {
  AUTOMATION_WAIT_HOURS_MAX,
  AUTOMATION_WAIT_HOURS_MIN,
  type AutomationWait,
} from '@liveplanner/items';
import { PanelField, PanelNote, PanelSelect } from './panel-parts';

const DAYS = Array.from({ length: AUTOMATION_WAIT_HOURS_MAX / 24 + 1 }, (_, i) => i);
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const clamp = (h: number) =>
  Math.min(AUTOMATION_WAIT_HOURS_MAX, Math.max(AUTOMATION_WAIT_HOURS_MIN, h));

export function WaitPanel({
  step,
  onChange,
}: {
  step: AutomationWait;
  onChange: (next: AutomationWait) => void;
}) {
  const days = Math.floor(step.hours / 24);
  const hours = step.hours % 24;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <PanelField label="Days">
          {(id) => (
            <PanelSelect
              id={id}
              value={String(days)}
              onChange={(e) =>
                onChange({ kind: 'wait', hours: clamp(Number(e.target.value) * 24 + hours) })
              }
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? '1 day' : `${d} days`}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
        <PanelField label="Hours">
          {(id) => (
            <PanelSelect
              id={id}
              value={String(hours)}
              disabled={days * 24 >= AUTOMATION_WAIT_HOURS_MAX}
              onChange={(e) =>
                onChange({ kind: 'wait', hours: clamp(days * 24 + Number(e.target.value)) })
              }
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h === 1 ? '1 hour' : `${h} hours`}
                </option>
              ))}
            </PanelSelect>
          )}
        </PanelField>
      </div>
      <PanelNote>
        The steps before this act now; the ones after it act when the time is up, if the rule’s
        conditions still hold. It shows as Waiting in the Audit Trail until then.
      </PanelNote>
    </div>
  );
}
