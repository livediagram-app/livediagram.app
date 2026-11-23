'use client';

// An element kind's own verbs (docs/specs/008-canvas/element-menu-quick-bar.md "Kind tools"): a mind node's Add Child
// and Add Sibling, a flowchart step's Add Step, Add Branch, Step Type and Lane, a relationship's cardinality, and the button that opens the element's own edit dialog (Edit Fields, Edit Code,
// Edit Data, Edit Flows, Edit Sequence, Edit Outline). They sit
// in a bar at the top of the element menu, with Save to Library at its right, not on the floating selection toolbar, so that toolbar keeps the same
// buttons on every element. The canvas, which holds the handlers, publishes them for the selected element; the menu
// shows them when it opens on that element.
import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import {
  MIND_CHILD_OPTION,
  MIND_SIBLING_OPTION,
  webRowOption,
} from '@/components/canvas/quick-connect-options';
import { Divider, PopoverButton } from '@/components/canvas/SelectionPopoverButton';
import dynamic from 'next/dynamic';
import {
  lucideBetweenHorizontalEnd,
  lucideBetweenVerticalEnd,
  lucideChartLine,
  lucideClock,
  lucideList,
  lucideListChecks,
  lucideCode,
  lucideListTree,
  lucideMessagesSquare,
  lucideRows2,
  lucideTable,
  lucideWaves,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
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

export type KindEditorKind =
  | 'fields'
  | 'code'
  | 'data'
  | 'flows'
  | 'sequence'
  | 'outline'
  | 'checklist'
  | 'legend'
  | 'segments'
  | 'table'
  | 'rows';
/** An element's own edit dialog: which one, and opening it. */
// `label` names a rows dialog for what it holds (Edit Stats, Edit Pyramid), in place of the kind's own.
export type KindEditor = { kind: KindEditorKind; open: () => void; label?: string };

export type ElementKindTools = {
  onAddMindChild?: () => void;
  onAddMindSibling?: () => void;
  // A concept graphic's add (Add Tier, Add Layer, ...), while it has room for one more.
  addRow?: { label: string; description: string; onAdd: () => void };
  flowchartStep?: FlowchartStepToolbar;
  cardinality?: CardinalityToolbar;
  // The element's own edit dialog (docs/specs/008-canvas/element-menu-quick-bar.md "Kind tools"): an entity's
  // fields, a code block's code, a line chart's data, a Sankey's flows, a sequence diagram, a mind map's outline.
  editor?: KindEditor;
  // A table's structure (docs/specs/008-canvas/canvas-and-palette.md): a row at its foot, a column at its right.
  table?: { onAddRow: () => void; onAddColumn: () => void };
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
  !!(t.onAddMindChild && t.onAddMindSibling) ||
  !!t.addRow ||
  !!t.flowchartStep ||
  !!t.cardinality ||
  !!t.editor ||
  !!t.table ||
  !!t.saveToLibrary;

/** The canvas: the selected element's kind tools, or none. Set before paint (a layout effect), so a menu opened in the
 *  same press catches up before it is seen; cleared when the selection goes. */
export function usePublishElementKindTools(id: string | null, tools: ElementKindTools): void {
  const mine = useRef<{ id: string; tools: ElementKindTools } | null>(null);
  useLayoutEffect(() => {
    const next = id && hasAny(tools) ? { id, tools } : null;
    // The latest callbacks always; the menu told only when what is on offer changes, so a render that hands over fresh
    // closures for the same tools never loops back through the menu.
    // The same snapshot object while the offer stands, so the menu's store read stays stable across renders.
    if (current && next && shapeOf(current) === shapeOf(next)) {
      current.tools = next.tools;
      mine.current = current;
      return;
    }
    const changed = shapeOf(current) !== shapeOf(next);
    current = next;
    mine.current = next;
    if (changed) listeners.forEach((l) => l());
  });
  // Gone with the canvas: its last offer goes with it.
  useLayoutEffect(
    () => () => {
      if (current !== null && current === mine.current) {
        current = null;
        listeners.forEach((l) => l());
      }
    },
    [],
  );
}

// Which element, its tools and their values (a step's type, its lane, an end's cardinality): what the menu draws. The
// functions count only as being there. Small: a handful of fields and a chart's lane titles.
function shapeOf(c: { id: string; tools: ElementKindTools } | null): string {
  if (!c) return '';
  return `${c.id}|${JSON.stringify(c.tools, (_, v: unknown) => (typeof v === 'function' ? 1 : v))}`;
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

// Each kind's edit dialog as a button: what it is called and what it opens.
const icon = (prims: Parameters<typeof lucideGlyph>[0]) => {
  const Icon = lucideGlyph(prims, 16);
  return <Icon />;
};
const KIND_EDITORS: Record<
  KindEditorKind,
  { label: string; description: string; icon: ReactNode }
> = {
  fields: {
    label: 'Edit Fields',
    description: "Add, edit and remove this entity's fields.",
    icon: icon(lucideTable),
  },
  code: {
    label: 'Edit Code',
    description: 'Write or paste the code, and pick its language.',
    icon: icon(lucideCode),
  },
  data: {
    label: 'Edit Data',
    description: "Edit the chart's series and values in a grid.",
    icon: icon(lucideChartLine),
  },
  flows: {
    label: 'Edit Flows',
    description: 'Edit what flows from where to where, and how much.',
    icon: icon(lucideWaves),
  },
  sequence: {
    label: 'Edit Sequence',
    description: 'Edit the participants and the messages between them.',
    icon: icon(lucideMessagesSquare),
  },
  outline: {
    label: 'Edit Outline',
    description: 'Edit the whole map as a list.',
    icon: icon(lucideListTree),
  },
  checklist: {
    label: 'Edit Checklist',
    description: 'Tick, reword, add and remove its rows.',
    icon: icon(lucideListChecks),
  },
  legend: {
    label: 'Edit Legend',
    description: 'Set the colour and the word on each row of the key.',
    icon: icon(lucideList),
  },
  table: {
    label: 'Edit Table',
    description: "Set its header, its striping and its cells' text.",
    icon: icon(lucideTable),
  },
  rows: {
    label: 'Edit Rows',
    description: 'Add, remove and reorder them, and set what it is made of.',
    icon: icon(lucideRows2),
  },
  segments: {
    label: 'Edit Segments',
    description: 'Name each part of the meeting and give it its minutes.',
    icon: icon(lucideClock),
  },
};

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
      {tools.addRow ? (
        <PopoverButton
          label={tools.addRow.label}
          description={tools.addRow.description}
          onClick={tools.addRow.onAdd}
        >
          {webRowOption(tools.addRow.label, tools.addRow.description).icon}
        </PopoverButton>
      ) : null}
      {tools.table ? (
        <>
          <PopoverButton
            label="Add Row"
            description="Add a row at the foot of the table."
            onClick={tools.table.onAddRow}
          >
            {icon(lucideBetweenHorizontalEnd)}
          </PopoverButton>
          <PopoverButton
            label="Add Column"
            description="Add a column at the right of the table."
            onClick={tools.table.onAddColumn}
          >
            {icon(lucideBetweenVerticalEnd)}
          </PopoverButton>
        </>
      ) : null}
      {tools.editor ? (
        <PopoverButton
          label={tools.editor.label ?? KIND_EDITORS[tools.editor.kind].label}
          description={KIND_EDITORS[tools.editor.kind].description}
          onClick={tools.editor.open}
        >
          {KIND_EDITORS[tools.editor.kind].icon}
        </PopoverButton>
      ) : null}
      {tools.flowchartStep ? (
        // Its own closing rule is dropped here: Save to Library sits apart at the right.
        <span className="contents [&>[aria-hidden]:last-child]:hidden">
          <FlowchartStepButtons {...tools.flowchartStep} menuAnchor="portal" />
        </span>
      ) : null}
      {tools.cardinality ? (
        <>
          {tools.flowchartStep || tools.onAddMindChild ? <Divider /> : null}
          <CardinalityButton {...tools.cardinality} menuAnchor="portal" />
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
  return (
    !!(t.onAddMindChild && t.onAddMindSibling) ||
    !!t.addRow ||
    !!t.flowchartStep ||
    !!t.cardinality ||
    !!t.editor ||
    !!t.table
  );
}
