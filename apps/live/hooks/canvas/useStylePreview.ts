'use client';

// Hover-to-preview for the style-preset tiles (spec/48) and the animation tiles
// (spec/09). On a desktop pointer, hovering a colour / border / arrow preset —
// or an Animation / Flow / Icon-animation tile — shows it live on the selected
// element(s); the change only sticks on click. Pulling the mouse off the tile
// reverts to the pre-hover look.
//
// How it stays correct:
//   - The first hover snapshots the affected elements' ORIGINAL values. Every
//     hover maps the preset from those originals (not from the current preview)
//     so hovering A then B previews B cleanly, never B-stacked-on-A.
//   - Preview + revert go through `tickTabs` (present-only, NO undo snapshot and
//     NO activity-log emit), so sweeping across a row of tiles can't spam
//     history or the realtime channel.
//   - The click commit restores the originals into the present FIRST, then
//     applies the preset. The two functional `setHistory` updaters compose in
//     one React batch, so undo snapshots the TRUE pre-hover state — not the
//     preview that was momentarily on screen. The activity entry is emitted with
//     the original `before`, so it diffs and reverts correctly.
//   - It also works with no prior hover (touch tap, or a click that never fired
//     pointerenter): the commit captures the originals on the spot.
//
// The element transforms come from lib/style-presets so a hover preview is
// byte-for-byte the change the matching click commits (and the same transform
// the direct setters in useElementStyle use).

import { useRef, type MutableRefObject } from 'react';
import { isBoxed } from '@livediagram/diagram';
import type {
  ArrowFlow,
  ArrowThickness,
  BorderRadius,
  BorderStroke,
  BorderStyle,
  Element,
  ElementAnimation,
  IconAnimation,
  Tab,
} from '@livediagram/diagram';
import {
  applyArrowPresetToEl,
  applyBorderPresetToEl,
  applyColorPresetToEl,
} from '@/lib/style-presets';
import type { ShapeColorPreset } from '@/lib/themes';
import { track } from '@/lib/telemetry';

type Snapshot = { ids: Set<string>; originals: Map<string, Element> };
type BorderPreset = { stroke: BorderStroke; style: BorderStyle; radius: BorderRadius };
type ArrowPreset = { style: BorderStyle; thickness: ArrowThickness; flow?: ArrowFlow };

export function useStylePreview(deps: {
  editsBlocked: boolean;
  activeId: string;
  // Selection resolved to element ids (single select expands to its group).
  currentSelectionIds: () => Set<string>;
  // Live tabs mirror — read the current elements without a stale render closure.
  tabsRef: MutableRefObject<Tab[]>;
  // Present-only mutator (no history, no log) for the ephemeral preview + revert.
  tickTabs: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  // History-pushing mutator for the committed change.
  commitTabs: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  // Activity-log emit for the committed change (before/after element diff).
  emitChange: (tabId: string, before: Element[], after: Element[]) => void;
}) {
  const { editsBlocked, activeId, currentSelectionIds, tabsRef, tickTabs, commitTabs, emitChange } =
    deps;

  const previewRef = useRef<Snapshot | null>(null);

  const elementsNow = (): Element[] =>
    tabsRef.current.find((t) => t.id === activeId)?.elements ?? [];

  // Capture the originals for the current selection (once per preview session).
  const ensureSnapshot = (): Snapshot | null => {
    if (previewRef.current) return previewRef.current;
    const ids = currentSelectionIds();
    if (ids.size === 0) return null;
    const originals = new Map<string, Element>();
    for (const el of elementsNow()) if (ids.has(el.id)) originals.set(el.id, el);
    if (originals.size === 0) return null;
    const snap: Snapshot = { ids, originals };
    previewRef.current = snap;
    return snap;
  };

  const writeElements = (elements: Element[]) => {
    tickTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, elements } : t)));
  };

  // Ephemeral preview of `mapEl` over the selection. Maps from the captured
  // originals so consecutive hovers don't compound.
  const previewStyle = (mapEl: (el: Element) => Element) => {
    if (editsBlocked) return;
    const snap = ensureSnapshot();
    if (!snap) return;
    writeElements(
      elementsNow().map((el) =>
        snap.originals.has(el.id) ? mapEl(snap.originals.get(el.id)!) : el,
      ),
    );
  };

  // Revert to the pre-hover look (mouse left the tile without clicking).
  const clearPreview = () => {
    const snap = previewRef.current;
    if (!snap) return;
    previewRef.current = null;
    writeElements(
      elementsNow().map((el) => (snap.originals.has(el.id) ? snap.originals.get(el.id)! : el)),
    );
  };

  // Commit `mapEl` as one history step + activity entry, from the true original
  // base (see the file header).
  const commitStyle = (mapEl: (el: Element) => Element, telemetryType: string) => {
    if (editsBlocked) return;
    const snap = ensureSnapshot();
    if (!snap) return;
    previewRef.current = null;
    const before = elementsNow().map((el) =>
      snap.originals.has(el.id) ? snap.originals.get(el.id)! : el,
    );
    const after = before.map((el) => (snap.ids.has(el.id) ? mapEl(el) : el));
    // Restore originals into the present (no history), THEN commit the result:
    // the composed updaters snapshot the original onto the undo stack.
    writeElements(before);
    commitTabs((ts) => ts.map((t) => (t.id === activeId ? { ...t, elements: after } : t)));
    emitChange(activeId, before, after);
    track('Element', 'Changed', telemetryType);
  };

  return {
    clearPreview,
    // Shape colour preset
    previewShapeColorPreset: (p: ShapeColorPreset) =>
      previewStyle((el) => applyColorPresetToEl(el, p)),
    commitShapeColorPreset: (p: ShapeColorPreset) =>
      commitStyle((el) => applyColorPresetToEl(el, p), 'StylePreset'),
    // Shape border preset
    previewShapeBorderPreset: (p: BorderPreset) =>
      previewStyle((el) => applyBorderPresetToEl(el, p)),
    commitShapeBorderPreset: (p: BorderPreset) =>
      commitStyle((el) => applyBorderPresetToEl(el, p), 'BorderPreset'),
    // Arrow preset
    previewArrowPreset: (p: ArrowPreset) => previewStyle((el) => applyArrowPresetToEl(el, p)),
    commitArrowPreset: (p: ArrowPreset) =>
      commitStyle((el) => applyArrowPresetToEl(el, p), 'ArrowPreset'),
    // Animation tiles (spec/09): the same hover-preview / click-commit flow,
    // each setting a single field on the matching member of the selection
    // (boxed `animation`, arrow `flow`, icon-shape `iconAnimation`). `null` is
    // the "None" tile. Reuses the snapshot/revert/commit machinery above, so a
    // hovered-then-clicked animation undoes to the true pre-hover value.
    previewAnimation: (v: ElementAnimation | null) =>
      previewStyle((el) => (isBoxed(el) ? { ...el, animation: v ?? undefined } : el)),
    commitAnimation: (v: ElementAnimation | null) =>
      commitStyle((el) => (isBoxed(el) ? { ...el, animation: v ?? undefined } : el), 'Animation'),
    previewArrowFlow: (v: ArrowFlow | null) =>
      previewStyle((el) => (el.type === 'arrow' ? { ...el, flow: v ?? undefined } : el)),
    commitArrowFlow: (v: ArrowFlow | null) =>
      commitStyle(
        (el) => (el.type === 'arrow' ? { ...el, flow: v ?? undefined } : el),
        'ArrowFlow',
      ),
    previewIconAnimation: (v: IconAnimation | null) =>
      previewStyle((el) =>
        el.type === 'shape' && el.shape === 'icon' ? { ...el, iconAnimation: v ?? undefined } : el,
      ),
    commitIconAnimation: (v: IconAnimation | null) =>
      commitStyle(
        (el) =>
          el.type === 'shape' && el.shape === 'icon'
            ? { ...el, iconAnimation: v ?? undefined }
            : el,
        'IconAnimation',
      ),
  };
}
