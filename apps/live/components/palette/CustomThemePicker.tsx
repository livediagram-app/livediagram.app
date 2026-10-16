'use client';

// The theme picker with custom-theme support (docs/specs/011-theme/custom-themes.md): the one flat
// ThemeBrowser, which lists the built-in themes, then the owner's saved themes and a "+ New theme" tile.
// This component owns the builder: picking New / Edit swaps the whole
// picker for the CustomThemeBuilder with a Cancel back to browsing.
//
// Shared by the right-click Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md) and the
// New-document / template picker (docs/specs/007-editor/new-document-route.md) so the two surfaces, and the
// custom-theme create/edit flow, can't drift. Selection is reported via
// onSelect / onCommit; the host decides what that means: apply live (the
// dialog) or stage the choice until Create (the new-document wizard).

import { useEffect, useState, type ReactNode } from 'react';
import { customDefinitionFromTheme } from '@/lib/custom-theme-registry';
import { type ThemeDefinition } from '@/lib/themes';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useCustomThemes } from '@/components/primitives/CustomThemeProvider';
import {
  CustomThemeBuilder,
  type CustomThemeDraft,
  type ThemeBuilding,
} from '@/components/palette/CustomThemeBuilder';
import { ThemeBrowser } from '@/components/palette/ThemeBrowser';

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
  // own chrome (the new-document wizard's Back / Create footer) can hide it
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
  const {
    themes: customThemes,
    createTheme,
    updateTheme,
    deleteTheme,
    writable,
  } = useCustomThemes();
  const confirm = useConfirm();
  // null = browsing; else the builder is open on a fresh theme or a saved one.
  const [building, setBuilding] = useState<ThemeBuilding | null>(null);
  // Prefill draft for a copied built-in theme (used only while building 'new').
  const [copySeed, setCopySeed] = useState<CustomThemeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    onBuildingChange?.(building !== null);
  }, [building, onBuildingChange]);

  const editingTheme =
    building !== null && building !== 'new'
      ? customThemes.find((t) => t.id === building.id)
      : undefined;

  const openBuilder = (target: ThemeBuilding) => {
    setSaveError(null);
    setCopySeed(null);
    setBuilding(target);
  };

  // "Copy" a built-in theme: open the builder as a new theme seeded with
  // that theme's options so the user can tweak it (docs/specs/011-theme/custom-themes.md).
  const copyTheme = (theme: ThemeDefinition) => {
    setSaveError(null);
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
        message: 'Documents using it fall back to the Default theme. This cannot be undone.',
        confirmLabel: 'Delete',
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
        // Select it so returning to the list shows the new theme highlighted.
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
      <ThemeBrowser
        themeId={themeId}
        onSelect={onSelect}
        onCommit={onCommit}
        className={browserClassName}
        customThemes={customThemes}
        // Without writes (a workbench) there is no builder: no custom themes, no Copy.
        onNewCustomTheme={writable ? () => openBuilder('new') : undefined}
        onEditCustomTheme={writable ? (id) => openBuilder({ id }) : undefined}
        onDeleteCustomTheme={writable ? confirmDelete : undefined}
        onCopyTheme={writable ? copyTheme : undefined}
      />
      {footer}
    </>
  );
}
