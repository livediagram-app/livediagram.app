'use client';

// The quick style panel's rows for a sticky note, a code block and a table
// (docs/specs/008-canvas/quick-style-panel.md "Sticky notes and code blocks"): the note's paper from its pad of
// colours with More colours at the end, and the code block's theme, in the same row rhythm as every colour row.

import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import type { QuickCodeStyle, QuickNoteStyle, QuickTableStyle } from '@/lib/quick-style-kinds';
import { standardGroup } from '@/components/colour/colour-options';
import { QuickRadioRow } from './quick-style-rows';
import { QUICK_ROW_TARGETS } from './quick-style-metrics';
import { QuickMoreColours } from './QuickMoreColours';

export function QuickKindRows({
  note,
  code,
  table,
  quickStyle,
  showTitles,
}: {
  note?: QuickNoteStyle;
  code?: QuickCodeStyle;
  table?: QuickTableStyle;
  quickStyle: QuickStyleApi;
  showTitles: boolean;
}) {
  return (
    <>
      {note ? (
        <QuickRadioRow
          title="Note colour"
          testId="quick-style-note-colour"
          showTitle={showTitles}
          options={note.options.map((o) => ({ ...o, content: null }))}
          columns={QUICK_ROW_TARGETS}
          value={note.value}
          onChoose={quickStyle.setNoteColour}
          more={
            <QuickMoreColours
              rowTitle="Note colour"
              value={null}
              standard={standardGroup('soft', 'light', 'hex')}
              onPick={quickStyle.setNoteFill}
            />
          }
        />
      ) : null}
      {code ? (
        <QuickRadioRow
          title="Code theme"
          testId="quick-style-code-theme"
          showTitle={showTitles}
          options={code.options.map((o) => ({ ...o, content: null }))}
          columns={QUICK_ROW_TARGETS}
          value={code.value}
          onChoose={quickStyle.setCodeTheme}
        />
      ) : null}
      {table ? (
        <>
          <QuickRadioRow
            title="Background"
            testId="quick-style-table-background"
            showTitle={showTitles}
            options={table.background.options.map((o) => ({ ...o, content: null }))}
            columns={QUICK_ROW_TARGETS}
            value={table.background.value}
            onChoose={quickStyle.setTableBackground}
            more={
              <QuickMoreColours
                rowTitle="Background"
                value={table.background.value}
                standard={standardGroup('soft', 'light', 'hex')}
                onPick={quickStyle.setTableBackground}
              />
            }
          />
          <QuickRadioRow
            title="Text colour"
            testId="quick-style-table-text"
            showTitle={showTitles}
            options={table.text.options.map((o) => ({ ...o, content: null }))}
            columns={QUICK_ROW_TARGETS}
            value={table.text.value}
            onChoose={quickStyle.setTableTextColour}
            more={
              <QuickMoreColours
                rowTitle="Text colour"
                value={table.text.value}
                standard={standardGroup('strong', 'light', 'hex')}
                onPick={quickStyle.setTableTextColour}
              />
            }
          />
        </>
      ) : null}
    </>
  );
}
