'use client';

// The Explorer "Themes" section (spec/44): manage the owner's saved
// custom themes. Lists each as a swatch preview + name with icon actions
// (edit / duplicate / delete), and a New-theme card. Editing / creating
// opens the shared CustomThemeBuilder in a modal (the same builder the
// Tab Appearance dialog hosts, so the two can't drift). Reads the
// reactive list + CRUD from CustomThemeProvider, which the Explorer shell
// mounts.

import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { useState } from 'react';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { useCustomThemes } from '@/components/primitives/CustomThemeProvider';
import { CustomThemeBuilder, type CustomThemeDraft } from '@/components/palette/CustomThemeBuilder';
import { EmptyState } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';
import { Tooltip } from '@/components/primitives/Tooltip';

export function ThemesPane() {
  const { themes, loading, createTheme, updateTheme, deleteTheme } = useCustomThemes();
  const confirm = useConfirm();
  const [building, setBuilding] = useState<null | 'new' | string>(null);
  const [saving, setSaving] = useState(false);

  const editing = typeof building === 'string' ? themes.find((t) => t.id === building) : undefined;

  const handleSave = async (draft: CustomThemeDraft) => {
    setSaving(true);
    try {
      if (building === 'new') {
        if (!(await createTheme(draft.name, draft.definition))) return;
      } else if (editing) {
        if (!(await updateTheme(editing.id, draft))) return;
      }
      setBuilding(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (id: string, name: string) => {
    if (
      await confirm({
        title: `Delete "${name}"?`,
        message: 'Diagrams using it fall back to the default theme. This cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'danger',
      })
    ) {
      deleteTheme(id);
    }
  };

  if (loading) {
    return <p className="px-1 py-8 text-sm text-slate-500">Loading themes…</p>;
  }

  return (
    <div>
      {themes.length === 0 ? (
        <EmptyState
          icon={<PaletteIcon />}
          title="No custom themes yet"
          description="Build your own colour palette and reuse it across every diagram, just like a built-in theme."
        >
          <button
            type="button"
            onClick={() => setBuilding('new')}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            New theme
          </button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {themes.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <ThemeSwatch theme={materialiseCustomTheme(t)} size="lg" />
              <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.name}
              </span>
              <div className="flex items-center gap-1">
                <Tooltip title="Edit" description="Open this theme in the builder.">
                  <IconBtn label="Edit theme" onClick={() => setBuilding(t.id)}>
                    <EditIcon />
                  </IconBtn>
                </Tooltip>
                <Tooltip title="Duplicate" description="Create a copy of this theme.">
                  <IconBtn
                    label="Duplicate theme"
                    onClick={() => void createTheme(`${t.name} copy`, t.definition)}
                  >
                    <DuplicateIcon />
                  </IconBtn>
                </Tooltip>
                <Tooltip title="Delete" description="Remove this theme.">
                  <IconBtn
                    label="Delete theme"
                    danger
                    onClick={() => void confirmDelete(t.id, t.name)}
                  >
                    <TrashIcon />
                  </IconBtn>
                </Tooltip>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBuilding('new')}
            className="flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-400"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium">New theme</span>
          </button>
        </div>
      )}

      {building !== null ? (
        <BuilderModal
          title={editing ? 'Edit theme' : 'New theme'}
          initial={editing ? { name: editing.name, definition: editing.definition } : undefined}
          saving={saving}
          onSave={handleSave}
          onClose={() => setBuilding(null)}
        />
      ) : null}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        'flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition dark:border-slate-700 dark:text-slate-300 ' +
        (danger
          ? 'hover:border-rose-300 hover:text-rose-600'
          : 'hover:border-brand-300 hover:text-brand-700')
      }
    >
      {children}
    </button>
  );
}

function BuilderModal({
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

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" strokeLinejoin="round" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Artist's palette — the empty-state badge glyph for custom themes.
function PaletteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3a9 9 0 1 0 0 18 1.8 1.8 0 0 0 1.8-1.8 1.8 1.8 0 0 1 1.8-1.8H17a3.5 3.5 0 0 0 3.5-3.5A8.6 8.6 0 0 0 12 3Z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.3" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
