// What a Get Started tour's steps open and close (docs/specs/007-editor/knowledge-tours.md "The tours"; blueprint
// knowledge-tours.md "Interfaces and contracts"): another view, by its footer tab; the page tree (a phone's Pages
// sheet, or a folded tree on a computer); Page Info where it is folded away. Each is opened by pressing the real
// control, as a person would, and the run remembers what it opened so `tidy` puts it back as the tour ends. Every
// anchor is an attribute the controls already carry: the tours add no markup of their own.
import { isOnScreen } from '@liveworkspace/workbench/components/tour/tour-dom';
import { currentKnowledgeView, type KnowledgeView } from '@/lib/knowledge-ask/knowledge-view';

export type KnowledgeTourApi = {
  /** Shows `view` by pressing its footer tab, unless it is showing already. */
  showView: (view: KnowledgeView) => void;
  /** Brings the page tree on screen: a phone's Pages sheet, or a folded tree unfolded. */
  openTree: () => void;
  /** Brings Page Health on screen: the docked rail unfolded, or Page Info's card or sheet opened. */
  openPageInfo: () => void;
  /** Puts back what the run opened. Safe to call twice. */
  tidy: () => void;
};

export const VIEW_TAB = (view: KnowledgeView) => `[data-knowledge-view-link="${view}"]`;
// The page tree, open beside the page or as a phone's sheet; folded to its rail; a phone's Pages button.
const TREE_ON_SCREEN = '[data-page-tree="open"], [data-page-tree="sheet"], [data-page-tree="peek"]';
const TREE_RAIL = '[data-page-tree="rail"]';
const TREE_EXPAND = '[data-page-tree-expand]';
const TREE_COLLAPSE = '[data-page-tree-collapse]';
const TREE_SHEET_BUTTON = '[data-page-tree-button]';
const PAGE_HEALTH = '[data-page-health]';
const RAIL_EXPAND = '[data-page-rail-expand]';
const RAIL_COLLAPSE = '[data-page-rail-collapse]';
const RAIL_BUTTON = '[data-page-rail-button]';

const press = (selector: string): boolean => {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el || el.getClientRects().length === 0) return false;
  el.click();
  return true;
};

// Escape as a sheet hears it, not as the tour does: the tour's card ignores a key with a modifier held, and the Pages
// sheet's own listener closes on any Escape (PageTreeSheet). Only ever sent once the card is gone or about to be.
const closeSheetByKey = () =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', shiftKey: true }));

/** A fresh api for one run, remembering what it opened. */
export function createKnowledgeTourApi(): KnowledgeTourApi {
  let treeSheet = false;
  let treeExpanded = false;
  let railExpanded = false;
  let infoOpened = false;
  return {
    showView: (view) => {
      if (currentKnowledgeView() !== view) press(VIEW_TAB(view));
    },
    openTree: () => {
      if (isOnScreen(TREE_ON_SCREEN)) return;
      if (isOnScreen(TREE_RAIL) && press(TREE_EXPAND)) {
        treeExpanded = true;
        return;
      }
      if (press(TREE_SHEET_BUTTON)) treeSheet = true;
    },
    openPageInfo: () => {
      if (isOnScreen(PAGE_HEALTH)) return;
      if (press(RAIL_EXPAND)) {
        railExpanded = true;
        return;
      }
      const button = document.querySelector<HTMLElement>(RAIL_BUTTON);
      if (button && button.getAttribute('aria-expanded') !== 'true' && press(RAIL_BUTTON))
        infoOpened = true;
    },
    tidy: () => {
      if (infoOpened) {
        const button = document.querySelector<HTMLElement>(RAIL_BUTTON);
        if (button?.getAttribute('aria-expanded') === 'true') button.click();
      }
      if (railExpanded) press(RAIL_COLLAPSE);
      if (treeExpanded) press(TREE_COLLAPSE);
      if (treeSheet && isOnScreen('[data-page-tree="sheet"]')) closeSheetByKey();
      treeSheet = treeExpanded = railExpanded = infoOpened = false;
    },
  };
}

/** The first selector whose first match is on screen, else the first: the engine then waits on it. */
export function pick(...selectors: string[]): string {
  return selectors.find((s) => isOnScreen(s)) ?? selectors[0]!;
}
