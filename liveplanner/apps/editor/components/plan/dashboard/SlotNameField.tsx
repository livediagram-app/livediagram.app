'use client';

// A Dashboard slot's **Name** field (docs/specs/026-plan/plan-tabs.md "A slot's name"), in the Slot section for an
// Editor: the slot's own name in place of its generated heading, on a slot showing a chart or metric (a plan view), a
// figure from a Sheet or a Form figure. Enter or leaving it saves the trimmed name (an empty one clears it, back to the
// generated name); Escape puts back what was there. An unchanged name saves nothing.
import { useRef, useState } from 'react';
import { TextInput } from '@liveplanner/ui';
import { BOARD_WIDGET_INFO } from '@liveplanner/plan-art';
import { PLAN_VISUALISATION_LABELS, planViewMetric } from '@liveplanner/items';
import {
  DASHBOARD_SLOT_NAME_MAX,
  slotNameOf,
  withSlotName,
  type DashboardContent,
  type Element,
} from '@liveplanner/project';
import {
  FORM_METRIC_NAMES,
  SHEET_METRIC_NAMES,
} from '@/components/palette/palette-dashboard-tiles';
import { SettingsBody, SettingsField } from '../settings-panel-parts';

// Every chart's name, by view id (a metric's id is not among them).
const VIEW_LABELS: Readonly<Record<string, string>> = PLAN_VISUALISATION_LABELS;

// The name a slot shows without one of its own, where it is fixed (a metric's label, a figure's kind, a chart's kind),
// or null for a slot that takes no name (a tab, a Board or Sheet, a Sheet Chart, a utility).
export function generatedSlotName(
  content: DashboardContent | undefined,
  element: Element | undefined,
): string | null {
  if (!content) return null;
  if (content.type === 'sheet-metric') return SHEET_METRIC_NAMES[content.metric];
  if (content.type === 'form-metric') return FORM_METRIC_NAMES[content.metric];
  if (content.type !== 'element') return null;
  const view =
    element?.type === 'shape' && element.shape === 'plan-view' ? element.planView?.view : undefined;
  if (!view) return null;
  const metric = planViewMetric(view);
  return metric ? BOARD_WIDGET_INFO[metric].label : (VIEW_LABELS[view] ?? null);
}

export function SlotNameField({
  content,
  placeholder,
  onSave,
}: {
  content: DashboardContent;
  // The generated name, shown while the field is empty.
  placeholder: string;
  onSave: (next: DashboardContent) => void;
}) {
  const stored = slotNameOf(content) ?? '';
  const [draft, setDraft] = useState(stored);
  // A name changed elsewhere (an undo, a collaborator) shows here.
  const [seen, setSeen] = useState(stored);
  // Escape cancels the edit even when it also closes the popover, whose blur follows before the draft re-renders.
  const cancelled = useRef(false);
  if (seen !== stored) {
    setSeen(stored);
    setDraft(stored);
  }
  return (
    <SettingsBody>
      <SettingsField label="Name">
        <TextInput
          compact
          className="w-full"
          value={draft}
          placeholder={placeholder}
          maxLength={DASHBOARD_SLOT_NAME_MAX}
          onChange={(e) => {
            cancelled.current = false;
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            // Typing stays in the field: no canvas or popover shortcuts.
            e.stopPropagation();
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelled.current = true;
              setDraft(stored);
            }
          }}
          onBlur={() => {
            if (cancelled.current) {
              cancelled.current = false;
              return;
            }
            const next = withSlotName(content, draft);
            if (next !== content) onSave(next);
            setDraft(slotNameOf(next) ?? '');
          }}
        />
      </SettingsField>
    </SettingsBody>
  );
}
