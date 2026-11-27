// The open tab as Plan AI works on it (docs/specs/026-plan/blueprints/plan-ai.md "The editor"): its kind and name,
// how it is read for the model, and how the model's changes are made through the editor's own edit paths, so each is
// an edit like the person's: undoable, synced live, and refused where their role or the tab's lock refuses it. Built
// from plain values and callbacks, so it is tested without the editor.
import { darkCanvas } from '@liveplanner/agent-verbs/assist';
import { FORM_VERSION, readForm, type FormDefinition } from '@liveplanner/forms';
import {
  normaliseBoardSetup,
  type Item,
  type ItemTypeDef,
  type PlanAiChange,
  type PlanAiKind,
} from '@liveplanner/items';
import { tabKindOf, type DashboardLayout, type Element, type Tab } from '@liveplanner/project';
import type { SheetWrite, Workbook } from '@liveplanner/sheets';
import { applyBoardChanges, type BoardActions } from './plan-ai-board';
import { applyDashboardChanges } from './plan-ai-dashboard';
import { applyFormTurn } from './plan-ai-form';
import type { PlanAiApplied } from './plan-ai-lines';
import { readBoard, readDashboard, readFormTab, readSheet } from './plan-ai-read';
import { applySheetChanges } from './plan-ai-sheet';

export type PlanAiTab = {
  kind: PlanAiKind;
  tabId: string;
  tabName: string;
  /** The tab as text for the model, or null when it can't be read yet (a sheet still loading). */
  read: () => string | null;
  /** Makes the model's changes: what each did, and how many undo steps they took. */
  apply: (changes: readonly PlanAiChange[]) => Promise<PlanAiApplied>;
};

export type PlanAiHostInput = {
  tab: Tab;
  tabs: readonly Tab[];
  projectId: string;
  board:
    (BoardActions & { items: ReadonlyMap<string, Item>; types: readonly ItemTypeDef[] }) | null;
  changeForm: (change: (form: FormDefinition) => FormDefinition) => void;
  renameForm: (name: string) => void;
  changeDashboard: (change: (layout: DashboardLayout) => DashboardLayout) => void;
  dashboardOf: (tab: Tab) => DashboardLayout;
  sheets: {
    workbook: (tabId: string) => Workbook;
    writeAll: (writes: readonly { sheetId: string; write: SheetWrite }[]) => string | null;
    commitElements: (map: (els: Element[]) => Element[]) => void;
    locale: string;
  } | null;
  newId?: () => string;
};

const NOT_HERE: PlanAiApplied = {
  lines: [{ text: 'This tab can’t be changed from here.', ok: false }],
  steps: 0,
};

const shapeOf = (tab: Tab, shape: string) =>
  tab.elements.find(
    (el): el is Element & { shape: string } =>
      el.type === 'shape' && (el as { shape?: string }).shape === shape,
  );

/** Plan AI's view of `input.tab`, or null for a tab it doesn't work on (a canvas). */
export function planAiTabOf(input: PlanAiHostInput): PlanAiTab | null {
  const { tab } = input;
  const kind = tabKindOf(tab);
  const base = { tabId: tab.id, tabName: tab.name };
  const newId = input.newId ?? (() => crypto.randomUUID());
  switch (kind) {
    case 'board': {
      const el = shapeOf(tab, 'plan-board');
      const setup = el ? normaliseBoardSetup((el as { planBoard?: unknown }).planBoard) : null;
      const board = input.board;
      return {
        kind,
        ...base,
        read: () =>
          setup && board ? readBoard({ setup, items: board.items, types: board.types }) : null,
        apply: (changes) =>
          setup && board
            ? applyBoardChanges({
                setup,
                items: board.items,
                types: board.types,
                changes,
                actions: board,
              })
            : Promise.resolve(NOT_HERE),
      };
    }
    case 'sheet': {
      const el = shapeOf(tab, 'plan-sheet');
      const sheetId = (el as { planSheet?: { sheetId?: string } } | undefined)?.planSheet?.sheetId;
      const sheets = input.sheets;
      return {
        kind,
        ...base,
        read: () => (sheets && sheetId ? readSheet(sheets.workbook(tab.id), sheetId) : null),
        apply: async (changes) =>
          sheets && sheetId && el
            ? applySheetChanges({
                live: sheets.workbook(tab.id),
                locale: sheets.locale,
                sheetId,
                changes,
                dark: darkCanvas(tab.backgroundColor),
                frame: el as { x: number; y: number; width: number; height: number },
                elements: tab.elements,
                sink: { writeAll: sheets.writeAll, commitElements: sheets.commitElements },
              })
            : NOT_HERE,
      };
    }
    case 'form': {
      // A Form tab not yet given a form reads as the empty one the builder starts it with.
      const form: FormDefinition = readForm(tab.form) ?? {
        v: FORM_VERSION,
        heading: tab.name,
        sections: [{ id: 's-1', title: '', questions: [] }],
      };
      return {
        kind,
        ...base,
        read: () => readFormTab(form),
        apply: async (changes) => {
          const types = input.board?.types ?? [];
          const made = applyFormTurn({
            projectId: input.projectId,
            formTab: { id: tab.id, name: tab.name, ...(tab.theme ? { theme: tab.theme } : {}) },
            form,
            tabs: input.tabs.map((t) => ({ id: t.id, name: t.name, kind: tabKindOf(t) })),
            types,
            changes,
          });
          if (!made.form) return { lines: made.lines, steps: 0 };
          const after = made.form;
          // The heading is the tab's name too: renamed through the form's own rename, its own step.
          const renamed = after.heading !== form.heading;
          input.changeForm(() => (renamed ? { ...after, heading: form.heading } : after));
          if (renamed) input.renameForm(after.heading);
          return { lines: made.lines, steps: renamed ? 2 : 1 };
        },
      };
    }
    case 'dashboard': {
      const layout = input.dashboardOf(tab);
      const tabs = input.tabs.map((t) => ({ id: t.id, name: t.name, kind: tabKindOf(t) }));
      return {
        kind,
        ...base,
        read: () => readDashboard(layout, tabs),
        apply: async (changes) => {
          const made = applyDashboardChanges(layout, changes, tabs, newId);
          if (made.layout === layout) return { lines: made.lines, steps: 0 };
          input.changeDashboard(() => made.layout);
          return { lines: made.lines, steps: 1 };
        },
      };
    }
    default:
      return null;
  }
}
