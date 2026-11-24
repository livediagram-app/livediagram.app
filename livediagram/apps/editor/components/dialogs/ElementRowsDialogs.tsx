'use client';

import {
  ElementRowsDialogs as SharedElementRowsDialogs,
  type ElementRowsProfile,
} from '@liveworkspace/workbench/components/dialogs/ElementRowsDialogs';
import type { Element } from '@livediagram/document';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import {
  ChecklistRowsEditor,
  LegendDataEditor,
  PieDataEditor,
} from '@/components/palette/context-menu-data-editors';
import { AgendaSegmentsEditor } from '@/components/palette/CollabMenuSections';
import { ConceptSettings, hasConceptSettings } from '@/components/palette/ConceptMenuSection';
import { WebRowsEditor, webRowsTitle } from '@/components/palette/context-menu-web-editors';
import { presetPxFor, TextSizeControl } from '@/components/palette/TextSizeControl';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { getTheme, themeChartPalette } from '@/lib/themes';
import { agendaSegmentsHeroArt } from './AgendaSegmentsHeroArt';

// This editor's row editors and controls, which the workbench's one copy of the rows dialogs draws. Its Chart Data
// editor takes negative values on a column or bar chart.
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
  useCustomColours: useDocumentColours,
};

// An element's rows in their dialog (docs/specs/008-canvas/canvas-and-palette.md "A category that opens a dialog"):
// a checklist's rows, a legend's, a pie, column or bar chart's slices, a table's look, an agenda's segments. The
// workbench's one copy, handed this editor's state, its row editors and the agenda's Segments dialog.
export function ElementRowsDialogs() {
  const editor = useEditorContext();
  return (
    <SharedElementRowsDialogs
      editor={editor}
      profile={PROFILE}
      themeRamp={themeChartPalette(getTheme(editor.activeTab.theme))}
      segments={{
        art: agendaSegmentsHeroArt,
        render: (target) => (
          <AgendaSegmentsEditor target={target} onSetItems={editor.setAgendaItemsSelected} />
        ),
      }}
    />
  );
}
