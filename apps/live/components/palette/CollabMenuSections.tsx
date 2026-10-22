'use client';

// The element-menu section for the decision record's status / date / drivers
// (docs/specs/012-collaboration/decision-record.md).
//
// Its own file for the same reason BehaviourMenuSections has one: it is a
// small form, and none of it belongs in the data-shape sections beside charts
// and rails.

import {
  DECISION_MAX_DRIVERS,
  DECISION_MAX_TEXT,
  DECISION_STATUSES,
  DECISION_STATUS_COLORS,
  DECISION_STATUS_LABELS,
  DEFAULT_DECISION_STATUS,
  type DecisionStatus,
  type ShapeElement,
} from '@liveplanner/document';
import { DateInput } from '@liveplanner/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { useFollowingDraft } from '@/hooks/ui/useFollowingDraft';
import { MENU_ADD_ROW_BUTTON, MENU_CELL_INPUT } from './menu-editor-classes';

const fieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const labelClass = 'text-[10px] font-medium text-slate-500 dark:text-slate-400';
const removeButtonClass =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800';

const NO_DRIVERS: string[] = [];

export function DecisionMenuSection({
  target,
  sectionProps,
  onSetStatus,
  onSetDate,
  onSetDrivers,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetStatus: (status: DecisionStatus) => void;
  onSetDate: (date: string | undefined) => void;
  onSetDrivers: (drivers: string[]) => void;
}) {
  const status = target?.decisionStatus ?? DEFAULT_DECISION_STATUS;
  const drivers = target?.decisionDrivers ?? NO_DRIVERS;
  // The row drafts follow the element's drivers when they change, adjusted during render.
  const [rows, setRows] = useFollowingDraft<string[]>(drivers);

  return (
    <MenuAccordionSection title="Decision" icon={<ToolsMenuGlyph />} {...sectionProps('decision')}>
      <div className="flex flex-col gap-2 px-2 py-1.5">
        <div>
          <span className={labelClass}>Status</span>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {DECISION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetStatus(s)}
                aria-pressed={status === s}
                className={`inline-flex items-center cursor-pointer rounded-md border px-1.5 py-1 text-[10px] font-semibold transition ${
                  status === s
                    ? 'border-transparent'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
                // The chosen status wears its own chip colours, so the picker
                // shows exactly what will land on the card.
                style={
                  status === s
                    ? {
                        backgroundColor: DECISION_STATUS_COLORS[s].bg,
                        color: DECISION_STATUS_COLORS[s].text,
                      }
                    : undefined
                }
              >
                <span className="text-optical-line text-optical-caps [--optical-tracking:0.04em]">
                  {DECISION_STATUS_LABELS[s]}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="lvd-decision-date">
            Date
          </label>
          <DateInput
            id="lvd-decision-date"
            unstyled
            className={`${fieldClass} mt-1`}
            value={target?.decisionDate}
            // Saves only a whole date (docs/specs/004-interface-design/date-fields.md); an emptied
            // field clears it entirely: an undated card shows nothing rather than "no date"
            // (docs/specs/012-collaboration/decision-record.md).
            onCommit={onSetDate}
          />
        </div>
        <div>
          <span className={labelClass}>Drivers</span>
          <div className="mt-1 flex flex-col gap-1">
            {rows.map((driver, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  className={`${MENU_CELL_INPUT} flex-1`}
                  value={driver}
                  placeholder="Why"
                  aria-label={`Driver ${i + 1}`}
                  maxLength={DECISION_MAX_TEXT}
                  onChange={(e) => setRows((r) => r.map((s, j) => (j === i ? e.target.value : s)))}
                  onBlur={() => onSetDrivers(rows)}
                />
                <button
                  type="button"
                  aria-label={`Remove driver ${i + 1}`}
                  onClick={() => onSetDrivers(rows.filter((_, j) => j !== i))}
                  className={removeButtonClass}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={rows.length >= DECISION_MAX_DRIVERS}
            onClick={() => onSetDrivers([...rows, ''])}
            className={MENU_ADD_ROW_BUTTON}
          >
            Add Driver
          </button>
        </div>
      </div>
    </MenuAccordionSection>
  );
}
