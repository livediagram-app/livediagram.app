// Opens a page of the knowledgebase (the page tree's rows, the breadcrumb): as every tab switch does
// (@liveworkspace/workbench/hooks/editor/useSelectTab), nothing selected or being edited follows to the next page.
import type { EditorContextValue } from '@/app/document/[id]/EditorContext';

export function selectPage(editor: EditorContextValue, id: string): void {
  if (id === editor.activeId) return;
  editor.setActiveId(id);
  editor.setSelectedId(null);
  editor.setMultiSelectedIds(new Set());
  editor.setEditingId(null);
  editor.setFormatSourceId(null);
}
