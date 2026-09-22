'use client';

// The custom-theme builder in a modal (spec/44), plus the copy for
// deleting a theme. Shared by the Explorer's Themes pane and the
// Timeline's theme-card menu, so "Edit theme" and "Delete" mean exactly
// the same thing from both places.

import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { Dialog } from '@/components/dialogs/Dialog';
import { CustomThemeBuilder, type CustomThemeDraft } from '@/components/palette/CustomThemeBuilder';

export type { CustomThemeDraft };

export function ThemeBuilderModal({
  title,
  initial,
  saving,
  onSave,
  onClose,
}: {
  title: string;
  initial?: CustomThemeDraft;
  saving: boolean;
  onSave: (draft: CustomThemeDraft) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={onClose} ariaLabel={title} size="lg" className="p-4">
      {/* Normal modal header (title + close), since the builder's own
          BackBar is suppressed in modal variant. */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        <DialogCloseButton compact onClick={onClose} />
      </div>
      <CustomThemeBuilder
        variant="modal"
        initial={initial}
        saving={saving}
        onSave={onSave}
        onCancel={onClose}
      />
    </Dialog>
  );
}

// What the confirm dialog says before a theme goes.
export function themeDeleteConfirm(name: string) {
  return {
    title: `Delete "${name}"?`,
    message: 'Diagrams using it fall back to the Default theme. This cannot be undone.',
    confirmLabel: 'Delete',
    variant: 'danger' as const,
  };
}
