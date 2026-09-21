// The colour / opacity setters for the current selection, lifted out of
// useElementStyle into its own sibling (like the arrow / shape / text /
// data-shape setter hooks). These deliberately bypass `commit`: they
// fire on every drag tick of a colour / slider control, so they write
// via the non-history tab mutator and debounce a single log entry —
// one undoable step per picker gesture. Keeping that policy in one
// file makes it auditable. `resetColorsSelected` (the "Reset to theme"
// action) lives here too since it is the inverse of these writes.

import type { Element, ElementShadow, Tab } from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import {
  applyFillColorToEl,
  applyShadowToEl,
  applyStrokeColorToEl,
  applyTextColorToEl,
} from '@/lib/style-presets';

export function useColorStyleSetters(deps: {
  currentSelectionIds: () => Set<string>;
  activeTab: Tab;
  activeId: string;
  editsBlocked: boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  markCheckpoint: () => number;
  scheduleElementChangeLog: (
    key: string,
    opts?: { fillToken?: number; onWindowStart?: () => number },
  ) => void;
}) {
  const {
    currentSelectionIds,
    activeTab,
    activeId,
    editsBlocked,
    commit,
    tickTabs,
    markCheckpoint,
    scheduleElementChangeLog,
  } = deps;

  // Debounced field write shared by the colour / opacity pickers:
  // one undoable step per gesture — the debounce window opening runs
  // the checkpoint (its token routes the flushed log entry to this
  // gesture's undo marker), then every tick mutates without history,
  // so dragging a picker doesn't spam the realtime channel or flood
  // the bounded undo stack. `update` maps one already-selected
  // element, returning it unchanged for the element types the field
  // doesn't apply to.
  const commitSelectedStyle = (logField: string, update: (el: Element) => Element) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    scheduleElementChangeLog(logField, { onWindowStart: markCheckpoint });
    tickTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? { ...t, elements: t.elements.map((el) => (ids.has(el.id) ? update(el) : el)) }
          : t,
      ),
    );
  };

  // Hand-editing any colour breaks a shape's colour-preset binding (spec/48):
  // the user has diverged from the preset, so a later theme change must NOT
  // pull the shape back onto the preset's variant. Clearing `colorPreset` on a
  // shape (a no-op field on other types) keeps that invariant in one place.
  const setFillColorSelected = (color: string) =>
    commitSelectedStyle('fillColor', (el) => applyFillColorToEl(el, color));

  const setStrokeColorSelected = (color: string) =>
    commitSelectedStyle('strokeColor', (el) => applyStrokeColorToEl(el, color));

  const setTextColorSelected = (color: string) =>
    commitSelectedStyle('textColor', (el) => applyTextColorToEl(el, color));

  // Table header-band colours (debounced like the other colour
  // pickers). Apply only to selected tables.
  const setTableHeaderFillSelected = (color: string) =>
    commitSelectedStyle('headerFill', (el) =>
      el.type === 'table' ? { ...el, headerFill: color } : el,
    );
  const setTableHeaderTextColorSelected = (color: string) =>
    commitSelectedStyle('headerTextColor', (el) =>
      el.type === 'table' ? { ...el, headerTextColor: color } : el,
    );

  const setOpacitySelected = (opacity: number) =>
    commitSelectedStyle('elementOpacity', (el) => ({ ...el, opacity }));

  // Shadow sliders (spec/86): four axes, same one-undo-step-per-gesture
  // policy as opacity. `null` clears (the Shadow section's None tile
  // commits through the preview path instead, but multi-callers may clear
  // here too).
  const setShadowSelected = (shadow: ElementShadow | null) =>
    commitSelectedStyle('elementShadow', (el) => applyShadowToEl(el, shadow));

  // Clear per-element colour overrides so the element falls back to
  // whatever the current tab theme dictates. Each colour field is set
  // to undefined; the history hook snapshots the present so this is
  // undoable as one step.
  const resetColorsSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    // "Reset to theme" applies the tab's current theme colours when
    // the tab has one set. Plain delete-the-override only works when
    // the theme is the brand default (its `elementFill / Stroke / Text`
    // are all null, so falling back to the type-default produces the
    // brand look). For any other theme we need to explicitly set the
    // colours since `addBoxed` is what normally writes them on create.
    const theme = getTheme(activeTab.theme);
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id)) return el;
        if (el.type === 'shape') {
          return {
            ...el,
            ...(theme.elementFill !== null
              ? { fillColor: theme.elementFill }
              : { fillColor: undefined }),
            ...(theme.elementStroke !== null
              ? { strokeColor: theme.elementStroke }
              : { strokeColor: undefined }),
            ...(theme.elementText !== null
              ? { textColor: theme.elementText }
              : { textColor: undefined }),
            // Reset-to-theme also drops any colour-preset binding (spec/48).
            colorPreset: undefined,
          };
        }
        if (el.type === 'text') {
          return {
            ...el,
            ...(theme.elementText !== null
              ? { textColor: theme.elementText }
              : { textColor: undefined }),
            fillColor: undefined,
            strokeColor: undefined,
          };
        }
        if (el.type === 'sticky') {
          // Sticky's amber palette is iconic — wipe any user overrides
          // but DON'T apply theme colours.
          const { fillColor: _f, strokeColor: _s, textColor: _t, ...rest } = el;
          return rest as typeof el;
        }
        if (el.type === 'table') {
          // Reset to theme grid + text; clear cell fill + header overrides.
          return {
            ...el,
            ...(theme.elementStroke !== null
              ? { strokeColor: theme.elementStroke }
              : { strokeColor: undefined }),
            ...(theme.elementText !== null
              ? { textColor: theme.elementText }
              : { textColor: undefined }),
            fillColor: undefined,
            headerFill: undefined,
            headerTextColor: undefined,
          };
        }
        if (el.type === 'arrow') {
          return {
            ...el,
            ...(theme.elementStroke !== null
              ? { strokeColor: theme.elementStroke }
              : { strokeColor: undefined }),
          };
        }
        return el;
      }),
    );
  };

  return {
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setTableHeaderFillSelected,
    setTableHeaderTextColorSelected,
    setOpacitySelected,
    setShadowSelected,
    resetColorsSelected,
  };
}
