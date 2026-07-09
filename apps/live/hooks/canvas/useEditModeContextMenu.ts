// Auto-open the element context menu while a label is being edited
// (spec/09): entering text-edit mode on a boxed element opens the menu
// beside the element (the standard elementMenuAnchor position) so
// whole-element styling stays one click away without leaving the editor,
// and exiting edit mode closes it again. Desktop only — on a mobile
// viewport the keyboard + menu would fight for space. Arrow labels and
// table cells keep their plain editors and don't auto-open a menu.

import { useEffect, useRef } from 'react';
import { isBoxed, type Element } from '@livediagram/diagram';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu';
import { elementMenuAnchor } from '@/lib/context-menu-anchor';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';

export function useEditModeContextMenu({
  editingId,
  elements,
  isReadOnly,
  setContextMenu,
}: {
  editingId: string | null;
  elements: Element[];
  isReadOnly: boolean;
  setContextMenu: React.Dispatch<React.SetStateAction<EditorContextMenuState | null>>;
}) {
  const isMobile = useIsMobileViewport();
  // Latest elements without retriggering the effect on every commit — the
  // menu should open / close on edit transitions only.
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const prevEditingRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevEditingRef.current;
    prevEditingRef.current = editingId;
    if (isReadOnly) return;
    if (editingId) {
      if (isMobile) return;
      const el = elementsRef.current.find((e) => e.id === editingId);
      if (!el || !isBoxed(el)) return;
      // The element's on-screen rect via its canvas wrapper — it exists
      // before editing starts, so measuring here (post-render) is safe.
      const node = document.querySelector(`[data-element-id="${editingId}"]`);
      if (!node) return;
      const { x, y } = elementMenuAnchor(node.getBoundingClientRect());
      setContextMenu({ mode: 'element', elementId: editingId, x, y });
    } else if (prev) {
      // Edit ended (commit or Escape): close the menu the session opened.
      // Only the element menu for that element — anything the user has
      // since opened deliberately (multi / canvas menu) is left alone.
      setContextMenu((cur) =>
        cur && cur.mode === 'element' && cur.elementId === prev ? null : cur,
      );
    }
    // setContextMenu is a stable useState setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, isMobile, isReadOnly]);
}
