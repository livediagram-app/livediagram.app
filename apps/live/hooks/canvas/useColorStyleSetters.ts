// The colour / opacity setters for the current selection, lifted out of
// useElementStyle into its own sibling (like the arrow / shape / text /
// data-shape setter hooks). These deliberately bypass `commit`: they
// fire on every drag tick of a colour / slider control, so they write
// via the non-history tab mutator and checkpoint once per burst (see
// useBurstCheckpoint), so a picker gesture is one undoable step. Keeping that policy in one
// file makes it auditable. `resetColorsSelected` (the "Reset to Theme"
// action) lives here too since it is the inverse of these writes.

import type { Element, ElementShadow, Tab } from '@livediagram/document';
import { getTheme } from '@/lib/themes';
import { resetElementColours } from '@/lib/reset-colours';
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
  checkpointBurst: (key: string) => void;
}) {
  const {
    currentSelectionIds,
    activeTab,
    activeId,
    editsBlocked,
    commit,
    tickTabs,
    checkpointBurst,
  } = deps;

  // Debounced field write shared by the colour / opacity pickers:
  // one undoable step per gesture (the burst opening runs the
  // checkpoint), then every tick mutates without history,
  // so dragging a picker doesn't spam the realtime channel or flood
  // the bounded undo stack. `update` maps one already-selected
  // element, returning it unchanged for the element types the field
  // doesn't apply to.
  const commitSelectedStyle = (field: string, update: (el: Element) => Element) => {
    if (editsBlocked) return;
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    checkpointBurst(field);
    tickTabs((ts) =>
      ts.map((t) =>
        t.id === activeId
          ? { ...t, elements: t.elements.map((el) => (ids.has(el.id) ? update(el) : el)) }
          : t,
      ),
    );
  };

  // Hand-editing any colour breaks a shape's colour-preset binding (docs/specs/010-palette/style-presets.md):
  // the user has diverged from the preset, so a later theme change must NOT
  // pull the shape back onto the preset's variant. Clearing `colorPreset` on a
  // shape (a no-op field on other types) keeps that invariant in one place.
  const setFillColorSelected = (color: string) =>
    commitSelectedStyle('fillColor', (el) => applyFillColorToEl(el, color));

  const setStrokeColorSelected = (color: string) =>
    commitSelectedStyle('strokeColor', (el) => applyStrokeColorToEl(el, color));

  const setTextColorSelected = (color: string) =>
    commitSelectedStyle('textColor', (el) => applyTextColorToEl(el, color));

  // Heading-band colour (debounced like the other colour pickers), for the
  // elements that have a heading distinct from their body: a table's header
  // row and a lane's title gutter (docs/specs/009-elements/lane.md). One field and one setter,
  // because it is one idea wearing two silhouettes.
  const setHeaderFillSelected = (color: string) =>
    commitSelectedStyle('headerFill', (el) => {
      // Hand-picking the band breaks a table's preset binding, like every
      // other colour on it (docs/specs/010-palette/style-presets.md).
      if (el.type === 'table') return { ...el, headerFill: color, tablePreset: undefined };
      return el.type === 'shape' && el.shape === 'lane' ? { ...el, headerFill: color } : el;
    });
  const setTableHeaderTextColorSelected = (color: string) =>
    commitSelectedStyle('headerTextColor', (el) =>
      el.type === 'table' ? { ...el, headerTextColor: color, tablePreset: undefined } : el,
    );

  // The arrowhead's own colour (docs/specs/008-canvas/canvas-and-palette.md arrow styles), for a head that should
  // not match its line.
  const setArrowheadColorSelected = (color: string) =>
    commitSelectedStyle('arrowheadColor', (el) =>
      el.type === 'arrow' ? { ...el, arrowheadColor: color } : el,
    );

  // The plate behind an arrow's label (docs/specs/008-canvas/canvas-and-palette.md "Caption").
  const setLabelFillSelected = (color: string) =>
    commitSelectedStyle('labelFill', (el) =>
      el.type === 'arrow' ? { ...el, labelFill: color } : el,
    );

  const setOpacitySelected = (opacity: number) =>
    commitSelectedStyle('elementOpacity', (el) => ({ ...el, opacity }));

  // Shadow sliders (docs/specs/008-canvas/element-shadows.md): four axes, same one-undo-step-per-gesture
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
    // "Reset to Theme" applies the tab's current theme colours when
    // the tab has one set. Plain delete-the-override only works when
    // the theme is the brand default (its `elementFill / Stroke / Text`
    // are all null, so falling back to the type-default produces the
    // brand look). For any other theme we need to explicitly set the
    // colours since `addBoxed` is what normally writes them on create.
    const theme = getTheme(activeTab.theme);
    commit((els) => els.map((el) => (ids.has(el.id) ? resetElementColours(el, theme) : el)));
  };

  return {
    setFillColorSelected,
    setStrokeColorSelected,
    setTextColorSelected,
    setHeaderFillSelected,
    setArrowheadColorSelected,
    setLabelFillSelected,
    setTableHeaderTextColorSelected,
    setOpacitySelected,
    setShadowSelected,
    resetColorsSelected,
  };
}
