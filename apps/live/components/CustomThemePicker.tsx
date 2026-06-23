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
import { customDefinitionFromTheme } from '@/lib/custom-theme-registry';
import { type ThemeDefinition } from '@/lib/themes';
import { useConfirm } from '@/hooks/ui/useConfirm';
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
  const confirm = useConfirm();
  // null = browsing; 'new' = building a fresh theme; an id = editing it.
  const [building, setBuilding] = useState<null | 'new' | string>(null);
  // Prefill draft for a copied built-in theme (used only while building 'new').
  const [copySeed, setCopySeed] = useState<CustomThemeDraft | null>(null);
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
    setCopySeed(null);
    setReturnToCustom(true);
    setBuilding(target);
  };

  // "Copy" a built-in theme: open the builder as a new theme seeded with
  // that theme's options so the user can tweak it (spec/44).
  const copyTheme = (theme: ThemeDefinition) => {
    setSaveError(null);
    setReturnToCustom(true);
    setCopySeed({ name: `${theme.label} copy`, definition: customDefinitionFromTheme(theme) });
    setBuilding('new');
  };

  const closeBuilder = () => {
    setBuilding(null);
    setCopySeed(null);
  };

  const confirmDelete = async (id: string) => {
    const theme = customThemes.find((t) => t.id === id);
    if (
      await confirm({
        title: `Delete "${theme?.name ?? 'theme'}"?`,
        message: 'Diagrams using it fall back to the default theme. This cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'danger',
      })
    ) {
      if (themeId === id) onSelect('brand');
      deleteTheme(id);
    }
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
      closeBuilder();
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
        seed={copySeed ?? undefined}
        saving={saving}
        error={saveError}
        onSave={handleSave}
        onCancel={closeBuilder}
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
        onDeleteCustomTheme={confirmDelete}
        onCopyTheme={copyTheme}
      />
      {footer}
    </>
  );
}
