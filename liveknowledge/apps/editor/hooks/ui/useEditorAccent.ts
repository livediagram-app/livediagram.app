'use client';

// The editor chrome follows the active tab's theme (docs/specs/011-theme/canvas-and-theme-dialog.md): the
// hook is @liveworkspace/workbench's, handed the accent stroke this editor's theme catalogue resolves.
import { useEditorAccentStroke } from '@liveworkspace/workbench/hooks/ui/useEditorAccent';
import { getTheme } from '@/lib/themes';

export function useEditorAccent(themeId: string | undefined): void {
  useEditorAccentStroke((themeId ? getTheme(themeId) : null)?.elementStroke ?? null);
}
