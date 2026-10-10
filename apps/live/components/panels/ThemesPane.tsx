'use client';

import { lucideGlyph } from '@livediagram/ui';
import { lucidePalette } from '@livediagram/icons/lucide';

// The Explorer "Themes" section (docs/specs/011-theme/custom-themes.md): manage the owner's saved
// custom themes. Lists each as a swatch preview + name with icon actions
// (edit / duplicate / delete), and a New-theme card. Editing / creating
// opens the shared CustomThemeBuilder in a modal (the same builder the
// Tab Look & Feel dialog hosts, so the two can't drift). Reads the
// reactive list + CRUD from CustomThemeProvider, which the Explorer shell
// mounts.

import { useState } from 'react';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { useCustomThemes } from '@/components/primitives/CustomThemeProvider';
import type { CustomThemeDraft } from '@/components/palette/CustomThemeBuilder';
import {
  CopyIcon,
  EmptyState,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  HoverCard,
  SOLID_BRAND_DARK_CONTROL,
} from '@livediagram/ui';
import { ThemeBuilderModal, themeDeleteConfirm } from './ThemeBuilderModal';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';

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
    if (await confirm(themeDeleteConfirm(name))) {
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
          description="Build your own colour palette and reuse it across every document, just like a built-in one."
        >
          <button
            type="button"
            onClick={() => setBuilding('new')}
            className={`rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 ${SOLID_BRAND_DARK_CONTROL}`}
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
                <HoverCard title="Edit" description="Open this theme in the builder.">
                  <IconBtn label="Edit theme" onClick={() => setBuilding(t.id)}>
                    <PencilIcon />
                  </IconBtn>
                </HoverCard>
                <HoverCard title="Duplicate" description="Create a copy of this theme.">
                  <IconBtn
                    label="Duplicate theme"
                    onClick={() => void createTheme(`${t.name} copy`, t.definition)}
                  >
                    <CopyIcon />
                  </IconBtn>
                </HoverCard>
                <HoverCard title="Delete" description="Remove this theme.">
                  <IconBtn label="Delete theme" onClick={() => void confirmDelete(t.id, t.name)}>
                    <TrashIcon />
                  </IconBtn>
                </HoverCard>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setBuilding('new')}
            className="flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:text-slate-400"
          >
            <PlusIcon size={20} />
            <span className="text-xs font-medium">New theme</span>
          </button>
        </div>
      )}

      {building !== null ? (
        <ThemeBuilderModal
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
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
    >
      {children}
    </button>
  );
}

// Artist's palette — the empty-state badge glyph for custom themes.
const PaletteIcon = lucideGlyph(lucidePalette, 28);
