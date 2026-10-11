'use client';

// A Sheet's settings in its element menu (docs/specs/029-sheets/sheet.md "Sheet Settings"): one Sheet flyout holding
// the same sections as the header's cog, drawn with the Sheet's own controller (sheet-settings-registry). Loaded with
// the sheet chunk; nothing shows for a Sheet not drawn here.
import { useFillsTab } from '@/hooks/plan/plan-cover-store';
import type { ComponentProps } from 'react';
import type { ShapeElement } from '@livediagram/document';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { SheetControllerProvider } from './sheet-controller';
import { SheetSettingsPanel } from './SheetSettingsPanel';
import { SheetArt } from './sheet-art';
import { useSheetSettingsEntry } from './sheet-settings-registry';

const noop = () => {};

export function SheetMenuSection({
  element,
  flyoutProps,
  onClose,
}: {
  element: ShapeElement;
  flyoutProps: Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
  onClose?: (() => void) | undefined;
}) {
  const entry = useSheetSettingsEntry(element.id);
  const filled = useFillsTab(element.id);
  if (!entry) return null;
  return (
    <MenuFlyoutSection title="Sheet" icon={<SheetArt size={16} />} panel {...flyoutProps}>
      <div className="flex flex-col py-1">
        <SheetControllerProvider value={entry.controller}>
          <SheetSettingsPanel
            actions={entry.actions}
            onImportCsv={entry.onImportCsv}
            onClose={onClose ?? noop}
            csvInTabMenu={filled}
          />
        </SheetControllerProvider>
      </div>
    </MenuFlyoutSection>
  );
}
