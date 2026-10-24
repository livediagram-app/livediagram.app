'use client';

// For tests: one category of this editor's catalogue in the shared pane, bound as the dialog binds
// it (settings-model.tsx), so a test can drive this editor's rows without the whole dialog.
import {
  SettingsCategoryPane as SharedPane,
  SettingsUiKitProvider,
} from '@liveworkspace/settings-ui';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import type { UserPreferences } from '@/lib/user-preferences';
import { SETTINGS_CATEGORIES, type SettingsCategorySpec } from './settings-catalogue';
import { SETTINGS_KIT } from './settings-kit';
import { settingsModel } from './settings-model';

export function SettingsCategoryPane({
  category,
  settings,
  onChange,
  focusRowKey = null,
  onGoToRow,
  onOpenCategory,
  offeredRowKeys,
  focusSectionId = null,
}: {
  category: SettingsCategorySpec;
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  focusRowKey?: string | null;
  onGoToRow?: (categoryId: string, rowKey: string) => void;
  onOpenCategory?: (categoryId: string) => void;
  // Without a list, every row of the catalogue counts as offered.
  offeredRowKeys?: ReadonlySet<string>;
  focusSectionId?: string | null;
}) {
  const isMobile = useIsMobileViewport();
  const offered =
    offeredRowKeys ?? new Set(SETTINGS_CATEGORIES.flatMap((c) => c.rows.map((r) => r.key)));
  const [model] = settingsModel([category], settings, onChange, offered);
  return (
    <SettingsUiKitProvider kit={SETTINGS_KIT}>
      <SharedPane
        category={model!}
        isMobile={isMobile}
        focusRowKey={focusRowKey}
        onGoToRow={onGoToRow}
        onOpenCategory={onOpenCategory}
        focusSectionId={focusSectionId}
      />
    </SettingsUiKitProvider>
  );
}
