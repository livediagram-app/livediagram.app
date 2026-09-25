import type { Element } from '@livediagram/diagram';

import { isTechIconId } from '@/lib/tech-icons';
import { track } from '@/lib/telemetry';

interface InlineIconMutatorsDeps {
  // True while edits are blocked (read-only share role / locked tab). Every
  // mutator short-circuits on it so the icon attach/detach paths match the
  // rest of the editor's guard behaviour.
  editsBlocked: boolean;
  // History-aware element write (the page's `commit`): maps the LIVE element
  // list to a new one as a single undo block.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
}

// Inline-icon attach/detach mutators (spec/09 icons). A shape can carry one
// inline icon (`iconId` + `iconPosition`); these three handlers are the only
// writers of that pair. Lifted out of useEditorState as a cohesive slice —
// they close over nothing but `editsBlocked` + `commit`.
export function useInlineIconMutators({ editsBlocked, commit }: InlineIconMutatorsDeps) {
  // Drop a palette icon onto a shape (drag-and-drop): set its inline
  // iconId + the side the icon landed on. History-aware via commit so
  // it's undoable like any other element edit. Guarded for read-only /
  // locked tabs and to regular shapes (the dedicated 'icon' shape has no
  // inline-icon slot).
  const dropIconOnElement = (
    elementId: string,
    iconId: string,
    position: 'left' | 'right' | 'above' | 'below',
  ) => {
    if (editsBlocked) return;
    commit((els) =>
      els.map((e) =>
        e.id === elementId && e.type === 'shape' && e.shape !== 'icon'
          ? { ...e, iconId, iconPosition: position }
          : e,
      ),
    );
    // A tech icon reports as `TechIcon`, the same type every other way of
    // adding one uses (useElementCreation's addTechIcon / palette drop), so
    // architecture-icon usage doesn't vanish into the line-art `Icon` count.
    track('Element', 'Added', isTechIconId(iconId) ? 'TechIcon' : 'Icon');
  };

  // Remove an inline icon from a shape (drops iconId + iconPosition).
  // To MOVE an icon, just drag another onto a different side — the drop
  // overwrites position; this is the explicit "take it off" path.
  const removeIconFromElement = (elementId: string) => {
    if (editsBlocked) return;
    commit((els) =>
      els.map((e) => {
        if (e.id !== elementId || e.type !== 'shape' || e.shape === 'icon') return e;
        const { iconId: _i, iconPosition: _p, ...rest } = e;
        void _i;
        void _p;
        return rest;
      }),
    );
  };

  // Fold a dragged standalone icon ELEMENT into a shape: set the target's
  // inline icon to the dragged icon's glyph + side, and delete the
  // standalone element — one commit so it's a single undo. Mirrors the
  // palette drag, but the source is an existing canvas element.
  const dropIconElementOnShape = (
    sourceId: string,
    targetId: string,
    position: 'left' | 'right' | 'above' | 'below',
  ) => {
    if (editsBlocked) return;
    commit((els) => {
      const source = els.find((e) => e.id === sourceId);
      const glyph =
        source && source.type === 'shape' && source.shape === 'icon' ? source.iconId : undefined;
      if (!glyph) return els;
      return els
        .filter((e) => e.id !== sourceId)
        .map((e) =>
          e.id === targetId && e.type === 'shape' && e.shape !== 'icon'
            ? { ...e, iconId: glyph, iconPosition: position }
            : e,
        );
    });
    // No `Element·Added` here: the glyph is an icon that was already counted
    // when it was first placed on the canvas, and this only moves it into a
    // shape. Counting it again made every fold-in a second icon (spec/22).
  };

  return { dropIconOnElement, removeIconFromElement, dropIconElementOnShape };
}
