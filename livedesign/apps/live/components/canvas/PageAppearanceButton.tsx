'use client';

// A wireframe page's Appearance on a phone (docs/specs/007-editor/pages-mode.md "Beside the cog", "On a phone"): one
// button in place of its Device, Layout and Background, its sheet a list of those controls (the shared
// AppearanceRowList). A press on a row closes this sheet and opens that control's own (mounted headless beside the
// bar), so each control keeps one body and one place to change it. While something on the page is selected that the
// Quick Style bar styles, its rows follow under Selected Element, on any page (docs/specs/008-canvas/quick-style-panel.md
// "On a phone, in Appearance").
import type { WireframeDeviceId } from '@livedesign/design';
import {
  lucidePaintRoller,
  lucidePanelsTopLeft,
  lucideSparkles,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { AppearanceRowList } from '@liveworkspace/workbench/components/canvas/AppearanceRowList';
import type { QuickStylePhoneRows } from '@/lib/quick-style-bar-slots';
import { track } from '@/lib/telemetry';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';
import { DeviceGlyph } from './wireframe/DeviceGlyph';

const AppearanceIcon = lucideGlyph(lucideSparkles, 14);

export type AppearanceRow = 'device' | 'layout' | 'background';

// The room it takes in the bar: its icon alone, or named beside it (measured: the name's 69.5 px at the bar's 12 px
// medium, with the button's padding, icon and gap, 38 px).
const APPEARANCE_ROOM = 28;
const APPEARANCE_LABELLED_ROOM = 108;

/** The room the button takes in a phone's title bar: named while the page on screen holds it, else its icon. */
export function pageAppearanceRoom(labelled: boolean): number {
  return labelled ? APPEARANCE_LABELLED_ROOM : APPEARANCE_ROOM;
}

/** The rows a page's Appearance lists: a wireframe page's look controls, in its desktop bar's order; none elsewhere. */
export function appearanceRows(b: { page: boolean; device?: boolean }): AppearanceRow[] {
  if (!b.page) return [];
  return [...(b.device ? (['device'] as const) : []), 'layout', 'background'];
}

const LayoutIcon = lucideGlyph(lucidePanelsTopLeft, 16);
const BackgroundIcon = lucideGlyph(lucidePaintRoller, 16);

const ROWS: Record<AppearanceRow, { name: string; line: string }> = {
  device: { name: 'Device', line: 'The phone, tablet or screen it is for' },
  layout: { name: 'Layout', line: 'Start the screen from a layout' },
  background: { name: 'Background', line: "The page's colour, picture or pattern" },
};

// The event each row's own button tracks as it opens, so a phone's opening counts as a desktop's does.
const ROW_EVENT: Partial<Record<AppearanceRow, string>> = {
  layout: 'PageLayoutsButton',
  background: 'PageBackgroundButton',
};

export function PageAppearanceButton({
  rows,
  device,
  labelled = false,
  selected = null,
  onPick,
}: {
  // The Quick Style rows while something on this page is selected (useQuickStylePhoneRows), else null.
  selected?: QuickStylePhoneRows | null;
  // Named beside its icon: a phone's bar while the page on screen has the room.
  labelled?: boolean;
  rows: readonly AppearanceRow[];
  // The page's device, drawn on its Device row as on its desktop button.
  device: WireframeDeviceId;
  // Opens the row's control, once this sheet has closed.
  onPick: (row: AppearanceRow) => void;
}) {
  const styled = selected !== null && selected.rows.length > 0;
  if (rows.length === 0 && !styled) return null;
  return (
    <div
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
            {rows.length > 0 ? (
              <AppearanceRowList
                rows={rows.map((row) => {
                  const icon =
                    row === 'device' ? (
                      <DeviceGlyph device={device} size={16} />
                    ) : row === 'layout' ? (
                      <LayoutIcon />
                    ) : (
                      <BackgroundIcon />
                    );
                  return { id: row, ...ROWS[row], icon };
                })}
                onPick={(row) => {
                  close();
                  const event = ROW_EVENT[row];
                  if (event) track('UI', 'Opened', event);
                  onPick(row);
                }}
              />
            ) : null}
            {styled ? (
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
