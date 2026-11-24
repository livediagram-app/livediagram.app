'use client';

import {
  ElementRowsDialogs as SharedElementRowsDialogs,
  type ElementRowsProfile,
} from '@liveworkspace/workbench/components/dialogs/ElementRowsDialogs';
import type { Element } from '@livedesign/design';
import { useEditorContext } from '@/app/design/[id]/EditorContext';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import {
  ChecklistRowsEditor,
  LegendDataEditor,
  PieDataEditor,
} from '@/components/palette/context-menu-data-editors';
import { ConceptSettings, hasConceptSettings } from '@/components/palette/ConceptMenuSection';
import { WebRowsEditor, webRowsTitle } from '@/components/palette/context-menu-web-editors';
import { presetPxFor, TextSizeControl } from '@/components/palette/TextSizeControl';
import { useDesignColours } from '@/hooks/ui/useDesignColours';
import { getTheme, themeChartPalette } from '@/lib/themes';

// This editor's row editors and controls, which the workbench's one copy of the rows dialogs draws.
const PROFILE: ElementRowsProfile<Element> = {
  ChecklistRowsEditor,
  LegendDataEditor,
  PieDataEditor,
  WebRowsEditor,
  webRowsTitle,
  ConceptSettings,
  hasConceptSettings,
  TextSizeControl,
  tablePresetPx: presetPxFor('table'),
  ColourSwatchButton,
  useCustomColours: useDesignColours,
};

// An element's rows in their dialog (docs/specs/008-canvas/canvas-and-palette.md "A category that opens a dialog"):
// a checklist's rows, a legend's, a pie, column or bar chart's slices, a table's look. The workbench's one copy,
// handed this editor's state and its row editors.
export function ElementRowsDialogs() {
  const editor = useEditorContext();
  return (
    <SharedElementRowsDialogs
      editor={editor}
      profile={PROFILE}
      themeRamp={themeChartPalette(getTheme(editor.activeTab.theme))}
    />
  );
}
