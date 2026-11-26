'use client';

// A page's Appearance on a phone (docs/specs/007-editor/pages-mode.md "Beside the cog", "On a phone, three buttons at
// most"): one button in place of the looks group (an article's Text, Layout, Design), its sheet a list of those
// controls. A press on a row closes this sheet and opens that control's own (mounted headless beside the bar, or Tab
// Style for Design), so each control keeps one body and one place to change it. No Style row (Work Tracker 1480):
// Design opens the very dialog it did.
import {
  lucideALargeSmall,
  lucidePaintRoller,
  lucidePanelsTopLeft,
  lucideSparkles,
} from '@liveworkspace/icons/lucide';
import { useState } from 'react';
import { lucideGlyph } from '@livedocuments/ui';
import { AppearanceRowList } from '@liveworkspace/workbench/components/canvas/AppearanceRowList';
import { track } from '@/lib/telemetry';
import { useQuickStylePhoneRows } from '@/lib/quick-style-bar-slots';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

const AppearanceIcon = lucideGlyph(lucideSparkles, 14);

export type AppearanceRow = 'layout' | 'background' | 'text';

// The room it takes in the bar: its icon alone, or named beside it (measured: the name's 69.5 px at the bar's 12 px
// medium, with the button's padding, icon and gap, 38 px, as Notes).
const APPEARANCE_ROOM = 28;
const APPEARANCE_LABELLED_ROOM = 108;

/** The room the button takes in a phone's title bar: named while the page on screen holds it, else its icon. */
export function pageAppearanceRoom(labelled: boolean): number {
  return labelled ? APPEARANCE_LABELLED_ROOM : APPEARANCE_ROOM;
}

/** The rows a page's Appearance lists: the looks controls its desktop bar would show, in the bar's order. */
export function appearanceRows(b: {
  // Tab Style offered (a page that is not an article's, a locked one too): its Design.
  style?: boolean;
  // An infographic or slide page's Layout and Design.
  page: boolean;
  // An article page's Text and Design (its own Style is a row in Tab Style and in its toolbar's More).
  article?: boolean;
}): AppearanceRow[] {
  const rows: AppearanceRow[] = [];
  if (b.article) rows.push('text');
  if (b.page) rows.push('layout');
  if (b.style || b.page || b.article) rows.push('background');
  return rows;
}

const ROWS: Record<AppearanceRow, { name: string; line: string; icon: () => React.JSX.Element }> = {
  text: {
    name: 'Text',
    line: 'Sizes and spacing of the writing',
    icon: lucideGlyph(lucideALargeSmall, 16),
  },
  layout: {
    name: 'Layout',
    line: 'Start the page from a layout',
    icon: lucideGlyph(lucidePanelsTopLeft, 16),
  },
  // Tab Style on Page Design: the page's background and the art over it, the tab's looks one Back away.
  background: {
    name: 'Design',
    line: 'Background and art behind your pages',
    icon: lucideGlyph(lucidePaintRoller, 16),
  },
};

// The event each row's own button tracks as it opens, so a phone's opening counts as a desktop's does.
function rowEvent(row: AppearanceRow): string {
  if (row === 'text') return 'PageArticleTextButton';
  if (row === 'layout') return 'PageLayoutsButton';
  return 'PageDesignButton';
}

export function PageAppearanceButton({
  pageId,
  rows,
  labelled = false,
  onPick,
}: {
  // Its page: while something on it is selected, the Quick Style rows follow the page's own
  // (docs/specs/008-canvas/quick-style-panel.md "On a phone, in Appearance").
  pageId: string;
  rows: readonly AppearanceRow[];
  // Named beside its icon: a phone's bar while the page on screen has the room.
  labelled?: boolean;
  // Opens the row's control: called once this sheet has closed, with the Appearance button (Tab Style drops from it).
  onPick: (row: AppearanceRow, from: HTMLElement | null) => void;
}) {
  // Held in state, not a ref: the sheet's rows read it as they press.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const selected = useQuickStylePhoneRows(pageId);
  if (rows.length === 0) return null;
  return (
    <div
      ref={setRoot}
      // The title bar takes no pointer events: the button opts back in, and a press on it is its own, never the
      // canvas's (no marquee, no deselect, no draw).
      className="pointer-events-auto flex items-center"
      data-page-appearance=""
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <TitlePopoverButton
        name="Appearance"
        labelled={labelled}
        className={titleButtonClass}
        icon={<AppearanceIcon />}
        width={280}
        padded={false}
        onOpen={() => track('UI', 'Opened', 'PageAppearance')}
      >
        {(close) => (
          <>
            <AppearanceRowList
              rows={rows.map((row) => {
                const { name, line, icon: Icon } = ROWS[row];
                return { id: row, name, line, icon: <Icon /> };
              })}
              onPick={(row) => {
                const from = root?.querySelector('button') ?? null;
                close();
                track('UI', 'Opened', rowEvent(row));
                onPick(row, from);
              }}
            />
            {selected && selected.rows.length > 0 ? (
              <AppearanceRowList
                heading="Selected Element"
                rows={selected.rows}
                onPick={(id) => {
                  close();
                  selected.open(id);
                }}
              />
            ) : null}
          </>
        )}
      </TitlePopoverButton>
    </div>
  );
}
