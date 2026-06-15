'use client';

// The theme picker with custom-theme support (spec/44): the built-in
// ThemeCategoryBrowser plus a "Custom" category (wired through the browser)
// whose drill-in lists the owner's saved themes and a "+ New theme" tile.
// This component owns the builder: picking New / Edit swaps the whole
// picker for the CustomThemeBuilder with a Cancel back to browsing.
//
// Shared by the right-click Tab Appearance dialog (spec/42) and the
// New-diagram / template picker (spec/14) so the two surfaces, and the
// custom-theme create/edit flow, can't drift. Selection is reported via
// onSelect / onCommit; the host decides what that means: apply live (the
// dialog) or stage the choice until Create (the new-diagram wizard).

import { useEffect, useState, type ReactNode } from 'react';
import { useCustomThemes } from './CustomThemeProvider';
import { CustomThemeBuilder, type CustomThemeDraft } from './CustomThemeBuilder';
import { ThemeCategoryBrowser } from './ThemeCategoryBrowser';

export function CustomThemePicker({
  // The selected theme: a built-in ThemeId or a custom `custom:<uuid>` id.
  themeId,
  onSelect,
  onCommit,
  // Optional explainer rendered above the browse (each host words it for
  // its own surface). Hidden while the builder is open.
  info,
  // Optional trailing content under the browser (e.g. the dialog's
  // "Reset elements to theme" action). Hidden while the builder is open.
  footer,
  // Notifies the host when the builder opens / closes, so a host with its
  // own chrome (the new-diagram wizard's Back / Create footer) can hide it
  // while the builder owns the surface.
  onBuildingChange,
  browserClassName = 'mt-4',
}: {
  themeId: string;
  onSelect: (id: string) => void;
  onCommit?: (id: string) => void;
  info?: ReactNode;
  footer?: ReactNode;
  onBuildingChange?: (building: boolean) => void;
  browserClassName?: string;
}) {
  const { themes: customThemes, createTheme, updateTheme, deleteTheme } = useCustomThemes();
  // null = browsing; 'new' = building a fresh theme; an id = editing it.
  const [building, setBuilding] = useState<null | 'new' | string>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onBuildingChange?.(building !== null);
  }, [building, onBuildingChange]);

  const editingTheme =
    typeof building === 'string' ? customThemes.find((t) => t.id === building) : undefined;

  const handleSave = async (draft: CustomThemeDraft) => {
    setSaving(true);
    try {
      if (building === 'new') {
        const created = await createTheme(draft.name, draft.definition);
        if (created) onSelect(created.id);
      } else if (editingTheme) {
        await updateTheme(editingTheme.id, draft);
        // Re-select so a live host repaints with the edited definition.
        onSelect(editingTheme.id);
      }
      setBuilding(null);
    } finally {
      setSaving(false);
    }
  };

  if (building !== null) {
    return (
      <CustomThemeBuilder
        initial={
          editingTheme
            ? { name: editingTheme.name, definition: editingTheme.definition }
            : undefined
        }
        saving={saving}
        onSave={handleSave}
        onCancel={() => setBuilding(null)}
      />
    );
  }

  return (
    <>
      {info}
      <ThemeCategoryBrowser
        themeId={themeId}
        onSelect={onSelect}
        onCommit={onCommit}
        className={browserClassName}
        customThemes={customThemes}
        onNewCustomTheme={() => setBuilding('new')}
        onEditCustomTheme={(id) => setBuilding(id)}
        onDeleteCustomTheme={deleteTheme}
      />
      {footer}
    </>
  );
}
