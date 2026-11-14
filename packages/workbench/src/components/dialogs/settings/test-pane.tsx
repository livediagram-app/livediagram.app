'use client';

// For tests: one category of an editor's catalogue in the shared pane, bound as the editor's dialog binds it (its
// settings-model.tsx), so a test can drive that editor's rows without the whole dialog. Each editor makes it once in
// its components/dialogs/settings/test-pane.tsx, around its own model and kit, typed on its catalogue's category `C`
// and its preferences `S`.
import {
  SettingsCategoryPane as SharedPane,
  SettingsUiKitProvider,
  type SettingsCategory,
  type SettingsUiKit,
} from '@liveworkspace/settings-ui';
import { useIsMobileViewport } from '../../../hooks/ui/useIsMobileViewport';

export type SettingsTestPaneDeps<C, S> = {
  settingsModel: (
    categories: readonly C[],
    settings: S,
    onChange: (next: S) => void,
  ) => SettingsCategory[];
  kit: SettingsUiKit;
};

/** The test pane, made once per editor at module scope. */
export function createSettingsTestPane<C, S>({ settingsModel, kit }: SettingsTestPaneDeps<C, S>) {
  function SettingsCategoryPane({
    category,
    settings,
    onChange,
    focusRowKey = null,
    focusSectionId = null,
  }: {
    category: C;
    settings: S;
    onChange: (next: S) => void;
    focusRowKey?: string | null;
    focusSectionId?: string | null;
  }) {
    const isMobile = useIsMobileViewport();
    const [model] = settingsModel([category], settings, onChange);
    return (
      <SettingsUiKitProvider kit={kit}>
        <SharedPane
          category={model!}
          isMobile={isMobile}
          focusRowKey={focusRowKey}
          focusSectionId={focusSectionId}
        />
      </SettingsUiKitProvider>
    );
  }

  return SettingsCategoryPane;
}
