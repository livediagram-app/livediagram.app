'use client';

// The Explorer "Themes" section (spec/44): manage the owner's saved
// custom themes. Lists each as a swatch preview + name with icon actions
// (edit / duplicate / delete), and a New-theme card. Editing / creating
// opens the shared CustomThemeBuilder in a modal (the same builder the
// Tab Appearance dialog hosts, so the two can't drift). Reads the
// reactive list + CRUD from CustomThemeProvider, which the Explorer shell
// mounts.

import { useState } from 'react';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useEscape } from '@/hooks/ui/useEscape';
import { materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { useCustomThemes } from './CustomThemeProvider';
import { CustomThemeBuilder, type CustomThemeDraft } from './CustomThemeBuilder';
import { CloseIcon } from './CloseIcon';
import { HelpArticleLink } from './HelpArticleLink';
import { Portal } from './Portal';
import { ThemeSwatch } from './ThemeSwatch';
import { Tooltip } from './Tooltip';

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
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-600">No custom themes yet.</p>
          <p className="mt-1 text-xs text-slate-400">
            Build your own palette and reuse it across diagrams.
          </p>
          <div className="mt-3 flex justify-center">
            <HelpArticleLink
              article="customThemes"
              variant="text"
              title="Custom themes"
              description="How to build a palette and reuse it across diagrams."
            />
          </div>
          <button
            type="button"
            onClick={() => setBuilding('new')}
            className="mt-4 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500"
          >
            New theme
          </button>
        </div>
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
  useEscape(onClose);
  return (
    <Portal>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-slate-950/60"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="flex max-h-[calc(100%-2rem)] w-[34rem] max-w-full flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Normal modal header (title + close), since the builder's own
              BackBar is suppressed in modal variant. */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <CloseIcon size={16} strokeWidth={1.6} />
            </button>
          </div>
          <CustomThemeBuilder
            variant="modal"
            initial={initial}
            saving={saving}
            onSave={onSave}
            onCancel={onClose}
          />
        </div>
      </div>
    </Portal>
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
