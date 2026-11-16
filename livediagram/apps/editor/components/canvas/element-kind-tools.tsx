'use client';

// An element kind's own verbs (docs/specs/008-canvas/element-menu-quick-bar.md "Kind tools"): a mind node's Add Child
// and Add Sibling, a flowchart step's Add Step, Add Branch, Step Type and Lane, a relationship's cardinality. They sit
// in a bar at the top of the element menu, with Save to Library at its right, not on the floating selection toolbar, so that toolbar keeps the same
// buttons on every element. The canvas, which holds the handlers, publishes them for the selected element; the menu
// shows them when it opens on that element.
import { useEffect, useSyncExternalStore } from 'react';
import { MIND_CHILD_OPTION, MIND_SIBLING_OPTION } from '@/components/canvas/quick-connect-options';
import { Divider, PopoverButton } from '@/components/canvas/SelectionPopoverButton';
import dynamic from 'next/dynamic';
import { SaveToLibraryButton } from '@liveworkspace/workbench/components/library/SaveToLibraryButton';
import type { LibrarySaveDraft } from '@liveworkspace/workbench/components/library/LibraryProvider';
import type { CardinalityToolbar } from '@/components/canvas/entity/CardinalityButton';
import {
  FlowchartStepButtons,
  type FlowchartStepToolbar,
} from '@/components/flowchart/FlowchartStepButtons';

// Loaded on first use, as the selection toolbar loaded it: most menus never show it.
const CardinalityButton = dynamic(
  () => import('@/components/canvas/entity/CardinalityButton').then((m) => m.CardinalityButton),
  { ssr: false },
);

export type ElementKindTools = {
  onAddMindChild?: () => void;
  onAddMindSibling?: () => void;
  flowchartStep?: FlowchartStepToolbar;
  cardinality?: CardinalityToolbar;
  // The element as a Library item (liveworkspace/docs/specs/006-media/libraries.md).
  saveToLibrary?: () => LibrarySaveDraft | null;
};

let current: { id: string; tools: ElementKindTools } | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const hasAny = (t: ElementKindTools) =>
  !!(t.onAddMindChild && t.onAddMindSibling) || !!t.flowchartStep || !!t.cardinality || !!t.saveToLibrary;

/** The canvas: the selected element's kind tools, or none. */
export function usePublishElementKindTools(id: string | null, tools: ElementKindTools): void {
  const next = id && hasAny(tools) ? { id, tools } : null;
  // Set while rendering, so the menu opened in the same press reads them; cleared when the selection goes.
  current = next;
  useEffect(() => {
    listeners.forEach((l) => l());
    return () => {
      if (current === next) current = null;
    };
  });
}

/** The element menu: the kind tools of the element it opened on. */
export function useElementKindTools(id: string): ElementKindTools | null {
  const snap = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return snap && snap.id === id ? snap.tools : null;
}

/** The kind tools as toolbar buttons, each named in its hover card. */
const SAVE_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

export function ElementKindToolButtons({
  tools,
  save = true,
}: {
  tools: ElementKindTools;
  // Save to Library with them (the element menu's bar); the Quick Style panel shows the kind's verbs alone.
  save?: boolean;
}) {
  return (
    <>
      {tools.onAddMindChild && tools.onAddMindSibling ? (
        <>
          <PopoverButton
            label={MIND_CHILD_OPTION.label}
            description={MIND_CHILD_OPTION.description}
            onClick={tools.onAddMindChild}
          >
            {MIND_CHILD_OPTION.icon}
          </PopoverButton>
          <PopoverButton
            label={MIND_SIBLING_OPTION.label}
            description={MIND_SIBLING_OPTION.description}
            onClick={tools.onAddMindSibling}
          >
            {MIND_SIBLING_OPTION.icon}
          </PopoverButton>
        </>
      ) : null}
      {tools.flowchartStep ? (
        // Its own closing rule is dropped here: Save to Library sits apart at the right.
        <span className="contents [&>[aria-hidden]:last-child]:hidden">
          <FlowchartStepButtons {...tools.flowchartStep} menuAnchor="self" />
        </span>
      ) : null}
      {tools.cardinality ? (
        <>
          {tools.flowchartStep || tools.onAddMindChild ? <Divider /> : null}
          <CardinalityButton {...tools.cardinality} menuAnchor="self" />
        </>
      ) : null}
      {/* Save to Library: pushed to the bar's right, which sets it apart (no rule needed). */}
      {save && tools.saveToLibrary ? (
        <span className="ml-auto flex items-center gap-0.5">
          <SaveToLibraryButton draft={tools.saveToLibrary} className={SAVE_BUTTON} />
        </span>
      ) : null}
    </>
  );
}

/** Whether the element has verbs of its kind (Save to Library aside). */
export function hasKindVerbs(t: ElementKindTools): boolean {
  return !!(t.onAddMindChild && t.onAddMindSibling) || !!t.flowchartStep || !!t.cardinality;
}
