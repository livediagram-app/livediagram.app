'use client';

// A Sheet's settings in its element menu (docs/specs/029-sheets/sheet.md "Sheet Settings"): the header cog's sections,
// each its own flyout row of the menu (under Style and a separator, as a board's are), drawn with the Sheet's own
// controller (sheet-settings-registry). There is no Sheet parent row: it cost a click and named nothing the rows did
// not. Loaded with the sheet chunk; nothing shows for a Sheet not drawn here.
import { useFillsTab } from '@/hooks/plan/plan-cover-store';
import type { ComponentProps } from 'react';
import type { ShapeElement } from '@livepages/document';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { SheetControllerProvider } from './sheet-controller';
import { SheetSettingsPanel } from './SheetSettingsPanel';
import { MenuGroupSeparator } from '@/components/primitives/PortalMenu';
import { useSheetSettingsEntry } from './sheet-settings-registry';

const noop = () => {};

export function SheetMenuSection({
  element,
  flyoutProps,
  onClose,
}: {
  element: ShapeElement;
  flyoutProps: (
    id: string,
  ) => Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
  onClose?: (() => void) | undefined;
}) {
  const entry = useSheetSettingsEntry(element.id);
  const filled = useFillsTab(element.id);
  if (!entry) return null;
  return (
    <>
      <MenuGroupSeparator />
      <SheetControllerProvider value={entry.controller}>
        <SheetSettingsPanel
          actions={entry.actions}
          onImportCsv={entry.onImportCsv}
          onClose={onClose ?? noop}
          csvInTabMenu={filled}
          asRow={({ id, title, icon, children }) => (
            // One surface of settings each, so a flyout row the menu keeps, never promoted inline.
            <MenuFlyoutSection
              title={title}
              icon={icon}
              panel
              {...flyoutProps(`plan-sheet-${id}`)}
              flush={id === 'data'}
            >
              <div className="flex flex-col py-1">{children}</div>
            </MenuFlyoutSection>
          )}
        />
      </SheetControllerProvider>
    </>
  );
}
