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
  const [saveError, setSaveError] = useState<string | null>(null);
  // Once the user has been in the builder, returning to the browse should
  // land back on the Custom category (where New / Edit live) rather than
  // the default overview — true whether they saved or cancelled.
  const [returnToCustom, setReturnToCustom] = useState(false);

  useEffect(() => {
    onBuildingChange?.(building !== null);
  }, [building, onBuildingChange]);

  const editingTheme =
    typeof building === 'string' ? customThemes.find((t) => t.id === building) : undefined;

  const openBuilder = (target: 'new' | string) => {
    setSaveError(null);
    setReturnToCustom(true);
    setBuilding(target);
  };

  const handleSave = async (draft: CustomThemeDraft) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (building === 'new') {
        const created = await createTheme(draft.name, draft.definition);
        // Persist FAILED (no owner yet / network): keep the builder open
        // so the user doesn't lose their work, and surface why — closing
        // silently here is what read as "Save did nothing".
        if (!created) {
          setSaveError("Couldn't save the theme. Check your connection and try again.");
          return;
        }
        // Select it so returning to the browse lands on the Custom
        // category with the new theme highlighted.
        onSelect(created.id);
      } else if (editingTheme) {
        const updated = await updateTheme(editingTheme.id, draft);
        if (!updated) {
          setSaveError("Couldn't save your changes. Check your connection and try again.");
          return;
        }
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
        error={saveError}
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
        initialCategory={returnToCustom ? 'custom' : undefined}
        onNewCustomTheme={() => openBuilder('new')}
        onEditCustomTheme={(id) => openBuilder(id)}
        onDeleteCustomTheme={deleteTheme}
      />
      {footer}
    </>
  );
}
