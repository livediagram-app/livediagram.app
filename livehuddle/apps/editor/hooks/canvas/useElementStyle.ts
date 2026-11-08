// Element styling / layering actions, lifted out of editor-page.tsx.
// Every handler here mutates a field (or fields) on the *current
// selection* — single-selected element or the whole multi-select
// bag, resolved through `currentSelectionIds`. They share one shape:
// read the selection ids, bail when empty, then `commit` (or, for the
// debounced colour / opacity edits, `commitTabs` + a scheduled log
// entry).
//
// What's deliberately NOT here:
// - Structural ops (duplicate, group, delete, marquee) — those touch
//   selection-mode state + navigation and stay in the page.
// - Link actions + followLink — link picker domain.
//
// Colour + opacity setters bypass `commit` on purpose: they fire on
// every drag tick of a colour / slider control, so they write via
// `tickTabs` (no per-tick history snapshot) and take one undo step per
// burst through `checkpointBurst`.
// Keeping that policy in one file makes it auditable.

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import {
  bringManyToFront,
  sendManyToBack,
  type AnimationSetId,
  type AnimationSpeed,
  type IconAnimation,
  type IconSize,
  type Element,
  type Padding,
  type ShapeElement,
  type Tab,
} from '@livehuddle/document';
import { track } from '@/lib/telemetry';
import { isStyleable } from '@/lib/style-presets';
import {
  withSetAnimationRepeat,
  withSetAnimationSpeed,
  withoutAnimations,
} from '@/lib/animation-set-writes';
import { useDataShapeSetters } from './useDataShapeSetters';
import { useShapeStyleSetters } from './useShapeStyleSetters';
import { useTextStyleSetters } from './useTextStyleSetters';
import { useColorStyleSetters } from './useColorStyleSetters';

type EditorElementStyleDeps = {
  // The active selection, resolved to a set of element ids (single
  // selection expands to its group members; multi-select returns the
  // marquee bag). Empty set = nothing selected.
  currentSelectionIds: () => Set<string>;
  // The "primary" element of the selection — the one whose current
  // value the toggles read to decide the next state (so a partially
  // applied group all jumps the same way).
  selectionPrimary: () => Element | null;
  // The single-selected element id (null in multi-select / none).
  // Shape-only setters (shape kind, border presets) target it
  // directly.
  // Read when a setter runs (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  // The active tab — read for its theme (resetColors) and id.
  activeTab: Tab;
  activeId: string;
  // True when edits are disallowed (a read-only role, a tab still loading). The
  // colour + opacity setters no-op when set.
  editsBlocked: boolean;
  // History-aware element mutator (snapshots + emits the log).
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // Non-history tab mutator + per-burst checkpoint for the high-
  // frequency colour / opacity setters: one undoable step per picker
  // gesture (a commit per onChange tick flooded the undo stack in a
  // single drag). Keyed by field name.
  tickTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  checkpointBurst: (key: string) => void;
};

export function useElementStyle(deps: EditorElementStyleDeps) {
  const {
    currentSelectionIds,
    selectionPrimary,
    readSelection,
    activeTab,
    activeId,
    editsBlocked,
    commit,
    tickTabs,
    checkpointBurst,
  } = deps;

  const dataShape = useDataShapeSetters({
    currentSelectionIds,
    commit,
    elements: () => activeTab.elements,
  });

  const shapeStyle = useShapeStyleSetters({
    currentSelectionIds,
    commit,
    activeTab,
    readSelection,
  });

  const textStyle = useTextStyleSetters({
    currentSelectionIds,
    selectionPrimary,
    commit,
    activeTab,
  });

  // The debounced colour / opacity policy + Reset-to-theme — see
  // useColorStyleSetters (the fifth setter sibling).
  const colorStyle = useColorStyleSetters({
    currentSelectionIds,
    activeTab,
    activeId,
    editsBlocked,
    commit,
    tickTabs,
    checkpointBurst,
  });

  const toggleAspectLockSelected = () => {
    const { selectedId } = readSelection();
    if (!selectedId) return;
    const source = selectionPrimary();
    if (!source || !isStyleable(source)) return;
    const shouldLock = !(source.aspectLocked === true);
    const ids = currentSelectionIds();
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isStyleable(el) ? { ...el, aspectLocked: shouldLock } : el,
      ),
    );
    track('Element', 'Toggled', 'AspectLock');
  };

  // Bring to Front / Send to Back are LAYER moves (docs/specs/006-document/layers.md): the
  // selection lands on the top (resp. bottom) layer, minting a fresh
  // edge layer when the current one holds anything else and pruning any
  // layer the move emptied. These two buttons are how layers accrue for
  // users who never open the Layers panel.
  const bringSelectedToFront = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => bringManyToFront(els, new Set(ids)));
    track('Element', 'Reordered', 'Front');
  };

  const sendSelectedToBack = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => sendManyToBack(els, new Set(ids)));
    track('Element', 'Reordered', 'Back');
  };

  const setPaddingSelected = (padding: Padding) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => els.map((el) => (ids.has(el.id) && isStyleable(el) ? { ...el, padding } : el)));
    track('Element', 'Changed', 'Padding');
  };

  // A Technology icon's fixed tile-size preset (docs/specs/010-palette/technology-icons.md). Applies to every
  // selected icon element (a no-op field elsewhere).
  const setIconSizeSelected = (iconSize: IconSize) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'icon' ? { ...el, iconSize } : el,
      ),
    );
    track('Element', 'Changed', 'IconSize');
  };

  // Clear animation (docs/specs/028-animation/element-animations.md "Shared behaviour"): the body and
  // the Text animation together. Picking one goes through the per-set setters below.
  const clearAnimationsSelected = () => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => els.map((el) => (ids.has(el.id) ? withoutAnimations(el) : el)));
    track('Element', 'Changed', 'Animation');
  };
  // Per-icon glyph animation (docs/specs/008-canvas/canvas-and-palette.md), gated to icon shapes — its own set
  // instead of the boxed-element animation. The animation + its loop speed
  // differ only in the patched field, so they share one body.
  const setIconFieldSelected = (patch: Partial<ShapeElement>) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && el.type === 'shape' && el.shape === 'icon' ? { ...el, ...patch } : el,
      ),
    );
    track('Element', 'Changed', 'IconAnimation');
  };
  // `null` clears the animation.
  const setIconAnimationSelected = (value: IconAnimation | null) =>
    setIconFieldSelected({ iconAnimation: value ?? undefined });
  // Loop speed (slow / normal / fast), mirroring setAnimationSpeedSelected.
  const setIconAnimationSpeedSelected = (value: AnimationSpeed) =>
    setIconFieldSelected({ iconAnimationSpeed: value });
  // Speed and Repeat for one animation set's category: only that set's members change.
  const setSetAnimationSpeedSelected = (set: AnimationSetId, value: AnimationSpeed) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) => els.map((el) => (ids.has(el.id) ? withSetAnimationSpeed(el, set, value) : el)));
    track('Element', 'Changed', 'AnimationSpeed');
  };
  // Repeat toggles (docs/specs/008-canvas/canvas-and-palette.md): true (the default) loops the animation, false
  // plays it once and holds. Stored as `undefined` when true so the common
  // case adds no field to the element.
  const setSetAnimationRepeatSelected = (set: AnimationSetId, value: boolean) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => (ids.has(el.id) ? withSetAnimationRepeat(el, set, value) : el)),
    );
    track('Element', 'Changed', 'AnimationRepeat');
  };
  const setIconAnimationRepeatSelected = (value: boolean) =>
    setIconFieldSelected({ iconAnimationRepeat: value ? undefined : false });

  return {
    ...dataShape,
    ...shapeStyle,
    ...textStyle,
    ...colorStyle,
    toggleAspectLockSelected,
    bringSelectedToFront,
    sendSelectedToBack,
    setPaddingSelected,
    setIconSizeSelected,
    clearAnimationsSelected,
    setIconAnimationSelected,
    setIconAnimationSpeedSelected,
    setSetAnimationSpeedSelected,
    setSetAnimationRepeatSelected,
    setIconAnimationRepeatSelected,
  };
}
