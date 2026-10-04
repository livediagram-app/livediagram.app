'use client';

// Which mind map roots carry the Edit Outline and Tidy Map badges, and what they do
// (docs/specs/009-elements/mind-node.md "Edit Outline"). A context, like MindGrowContext, because
// the consumer is every boxed element's badge strip, far below the editor state that opens the
// dialog. Its value is keyed on the set of badged roots, so it changes only when that set does,
// never on an ordinary edit: a context change re-renders every element that reads it.
//
// Undefined outside the editor canvas (the share view, embeds, exports): no badge there.
import { createContext, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { isMindNode, mindRootOf, type Element } from '@livediagram/document';

export type MindOutlineBadges = {
  roots: ReadonlySet<string>;
  open: (id: string) => void;
  tidy: (id: string) => void;
};

const MindOutlineContext = createContext<MindOutlineBadges | undefined>(undefined);

export const MindOutlineProvider = MindOutlineContext.Provider;

/** A map root's badge actions for element `id`, or undefined when it carries no badges. */
export function useMindOutlineBadge(
  id: string,
): { editOutline: () => void; tidy: () => void } | undefined {
  const badges = useContext(MindOutlineContext);
  if (!badges?.roots.has(id)) return undefined;
  return { editOutline: () => badges.open(id), tidy: () => badges.tidy(id) };
}

/**
 * The badged roots (map roots with at least one child that `canEdit` allows) and a stable opener,
 * for the canvas to provide.
 */
export function useMindOutlineBadges(
  elements: Element[],
  canEdit: ((id: string) => boolean) | undefined,
  onEdit: ((id: string) => void) | undefined,
  onTidy: ((id: string) => void) | undefined,
): MindOutlineBadges | undefined {
  const parents = new Set<string>();
  for (const el of elements) if (isMindNode(el) && el.mindParentId) parents.add(el.mindParentId);
  const key = canEdit
    ? elements
        .filter(
          (el) =>
            parents.has(el.id) &&
            isMindNode(el) &&
            mindRootOf(elements, el).id === el.id &&
            canEdit(el.id),
        )
        .map((el) => el.id)
        .join(' ')
    : '';
  // The opener reads the latest handler, so the value need not change when it does.
  const onEditRef = useRef(onEdit);
  const onTidyRef = useRef(onTidy);
  useLayoutEffect(() => {
    onEditRef.current = onEdit;
    onTidyRef.current = onTidy;
  });
  const hasEditor = !!onEdit;
  return useMemo(
    () =>
      hasEditor
        ? {
            roots: new Set(key ? key.split(' ') : []),
            open: (id) => onEditRef.current?.(id),
            tidy: (id) => onTidyRef.current?.(id),
          }
        : undefined,
    [key, hasEditor],
  );
}
