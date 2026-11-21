'use client';

// The editor chrome follows the knowledgebase's theme (docs/specs/030-knowledgebase/page-surface.md "The chrome
// follows the theme"; docs/specs/011-theme/canvas-and-theme-dialog.md "Editor chrome follows the active theme"):
// the hook is @liveworkspace/workbench's, handed the accent the knowledgebase's theme resolves to. The product's
// own theme hands it nothing, so the built-in lime ramp stands.
import { useEditorAccentStroke } from '@liveworkspace/workbench/hooks/ui/useEditorAccent';
import { knowledgeChromeAccent } from '@/lib/knowledge-style/knowledge-accent';

export function useEditorAccent(themeId: string | undefined): void {
  useEditorAccentStroke(knowledgeChromeAccent(themeId));
}
