'use client';

// The template step's mode filter (docs/specs/007-editor/templates-by-mode.md "The mode filter"):
// All or one editor mode, chosen afresh each time the step opens, narrowing every view of the
// catalogue to that mode's templates. Only the modes offered on this device are options, and a
// template of a mode not offered is never shown. Choosing a mode the selected template is not of
// selects that mode's blank, so one card is always selected and Next never starts something
// filtered away.
import { useCallback, useMemo, useState } from 'react';
import {
  BLANK_TEMPLATE_FOR_MODE,
  TEMPLATES,
  templateEditorMode,
  type TemplateDescriptor,
  type TemplateKind,
} from '@livediagram/templates';
import type { EditorMode } from '@livediagram/document';
import { useOfferedEditorModes } from '@/lib/offered-editor-modes';
import { track } from '@/lib/telemetry';

export type TemplateModeChoice = 'all' | EditorMode;

const MODE_EVENT: Record<TemplateModeChoice, string> = {
  all: 'TemplateModeAll',
  diagram: 'TemplateModeDiagram',
  draw: 'TemplateModeDraw',
  illustrate: 'TemplateModeIllustrate',
  plan: 'TemplateModePlan',
};

export type TemplateModeFilter = {
  // The choice in force (All when the chosen mode is no longer offered).
  choice: TemplateModeChoice;
  // All, then the offered modes in catalogue order.
  options: readonly TemplateModeChoice[];
  choose: (next: TemplateModeChoice) => void;
  // Whether a template shows under the choice.
  shows: (t: TemplateDescriptor) => boolean;
  // Whether a template shows under Everything (its mode is offered).
  offered: (t: TemplateDescriptor) => boolean;
  // How many listed templates each option holds.
  counts: Readonly<Record<TemplateModeChoice, number>>;
};

export function useTemplateModeFilter({
  selected,
  onSelect,
  initial = null,
}: {
  selected: TemplateKind;
  onSelect: (kind: TemplateKind) => void;
  // The mode to open on (a `/new?mode=` preset); null opens on Everything.
  initial?: EditorMode | null;
}): TemplateModeFilter {
  const offered = useOfferedEditorModes();
  // Undefined until the author chooses: until then the preset (or Everything) is the choice.
  const [chosenState, setChosen] = useState<TemplateModeChoice | undefined>(undefined);
  const chosen: TemplateModeChoice = chosenState ?? initial ?? 'all';
  const choice = chosen !== 'all' && !offered.includes(chosen) ? 'all' : chosen;
  const shows = useCallback(
    (t: TemplateDescriptor) => {
      const mode = templateEditorMode(t.kind);
      return offered.includes(mode) && (choice === 'all' || mode === choice);
    },
    [offered, choice],
  );
  const offeredTemplate = useCallback(
    (t: TemplateDescriptor) => offered.includes(templateEditorMode(t.kind)),
    [offered],
  );
  const counts = useMemo(() => {
    const out: Record<TemplateModeChoice, number> = {
      all: 0,
      diagram: 0,
      draw: 0,
      illustrate: 0,
      plan: 0,
    };
    for (const t of TEMPLATES) {
      const mode = templateEditorMode(t.kind);
      if (t.hidden || !offered.includes(mode)) continue;
      out.all += 1;
      out[mode] += 1;
    }
    return out;
  }, [offered]);
  const choose = (next: TemplateModeChoice) => {
    if (next === choice) return;
    track('UI', 'Toggled', MODE_EVENT[next]);
    setChosen(next);
    const selectedMode = templateEditorMode(selected);
    if (next !== 'all' && selectedMode !== next) onSelect(BLANK_TEMPLATE_FOR_MODE[next]);
  };
  return {
    choice,
    options: ['all', ...offered],
    choose,
    shows,
    offered: offeredTemplate,
    counts,
  };
}
