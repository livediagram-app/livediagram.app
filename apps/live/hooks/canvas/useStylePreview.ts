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
  IconPosition,
  ElementShadow,
  IconSize,
  Padding,
  ShapeKind,
  ShapeMarker,
  Tab,
  TextAlignX,
  TextAlignY,
  TextSize,
} from '@livediagram/diagram';
import {
  applyArrowPresetToEl,
  applyBorderRadiusToEl,
  applyBorderStrokeToEl,
  applyBorderStyleToEl,
  applyColorPresetToEl,
  applyFillColorToEl,
  applyFontToEl,
  applyShadowToEl,
  applyIconSizeToEl,
  applyInlineIconToEl,
  applyMarkerSizeToEl,
  applyMarkerToEl,
  applyPaddingToEl,
  applyRotationToEl,
  applyShapeKindToEl,
  applyStrokeColorToEl,
  applyTextAlignToEl,
  applyTextColorToEl,
  applyTextSizeToEl,
} from '@/lib/style-presets';
import type { ShapeColorPreset } from '@/lib/themes';
import { track } from '@/lib/telemetry';

type Snapshot = { ids: Set<string>; originals: Map<string, Element> };
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
  // Flipped on while a preview is on screen so autosave skips the ephemeral
  // tick (the preview mutates `tabs` to render, but must not be persisted).
  // Cleared by the commit and the revert.
  previewingRef: MutableRefObject<boolean>;
}) {
  const {
    editsBlocked,
    activeId,
    currentSelectionIds,
    tabsRef,
    tickTabs,
    commitTabs,
    emitChange,
    previewingRef,
  } = deps;

  const previewRef = useRef<Snapshot | null>(null);

  const elementsNow = (): Element[] =>
    tabsRef.current.find((t) => t.id === activeId)?.elements ?? [];

  // Capture the originals for the current selection (once per preview
  // session). `idsOverride` narrows the scope for controls that act on
  // explicit elements rather than the resolved selection — shape morph and
  // inline-icon placement target the clicked element, not its whole group.
  const ensureSnapshot = (idsOverride?: Set<string>): Snapshot | null => {
    if (previewRef.current) return previewRef.current;
    const ids = idsOverride ?? currentSelectionIds();
    if (ids.size === 0) return null;
    const originals = new Map<string, Element>();
    for (const el of elementsNow()) if (ids.has(el.id)) originals.set(el.id, el);
    if (originals.size === 0) return null;
    const snap: Snapshot = { ids, originals };
    previewRef.current = snap;
    return snap;
  };

  const writeElements = (elements: Element[]) => {
    const mapTabs = (ts: Tab[]) => ts.map((t) => (t.id === activeId ? { ...t, elements } : t));
    // Keep the live mirror in lockstep with this write. `tabsRef` is otherwise
    // only re-synced to React state in a post-render effect, so it LAGS a
    // tickTabs by a frame. Sweeping the pointer across a row of tiles fires
    // pointerleave→pointerenter pairs faster than that: the leave's revert
    // (clearPreview) nulls previewRef and schedules the restore, then the next
    // tile's ensureSnapshot — seeing previewRef null — re-captures "originals"
    // from the still-stale ref, baking the PREVIOUS preview in as the baseline.
    // The final leave then reverts to that polluted baseline, leaving a tile the
    // user only hovered stuck on the element (the "a random one got selected"
    // bug). Writing the ref eagerly here makes every elementsNow() read reflect
    // the latest preview/revert immediately, so the snapshot is always true.
    tabsRef.current = mapTabs(tabsRef.current);
    tickTabs(mapTabs);
  };

  // Ephemeral preview of `mapEl` over the selection. Maps from the captured
  // originals so consecutive hovers don't compound.
  const previewStyle = (mapEl: (el: Element) => Element, ids?: Set<string>) => {
    if (editsBlocked) return;
    const snap = ensureSnapshot(ids);
    if (!snap) return;
    // Mark the preview active so autosave ignores this (and any subsequent)
    // tick until the pointer leaves (clearPreview) or the user clicks (commit).
    previewingRef.current = true;
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
    // Preview gone: the revert tick below restores the pre-hover state, which
    // equals what's already saved, so letting autosave run again is a no-op.
    previewingRef.current = false;
    writeElements(
      elementsNow().map((el) => (snap.originals.has(el.id) ? snap.originals.get(el.id)! : el)),
    );
  };

  // Commit `mapEl` as one history step + activity entry, from the true original
  // base (see the file header).
  const commitStyle = (
    mapEl: (el: Element) => Element,
    telemetryType: string,
    ids?: Set<string>,
  ) => {
    if (editsBlocked) return;
    const snap = ensureSnapshot(ids);
    if (!snap) return;
    previewRef.current = null;
    // The click commits for real: let autosave persist the result below.
    previewingRef.current = false;
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
    // Arrow preset
    previewArrowPreset: (p: ArrowPreset) => previewStyle((el) => applyArrowPresetToEl(el, p)),
    commitArrowPreset: (p: ArrowPreset) =>
      commitStyle((el) => applyArrowPresetToEl(el, p), 'ArrowPreset'),
    // Granular colour swatches (text / fill / stroke): the same hover-preview /
    // click-commit flow as the presets, one field per swatch. The custom colour
    // <input> drag stays on the debounced useElementStyle setter — only the
    // discrete swatch tiles preview.
    previewFillColor: (c: string) => previewStyle((el) => applyFillColorToEl(el, c)),
    commitFillColor: (c: string) => commitStyle((el) => applyFillColorToEl(el, c), 'FillColor'),
    previewStrokeColor: (c: string) => previewStyle((el) => applyStrokeColorToEl(el, c)),
    commitStrokeColor: (c: string) =>
      commitStyle((el) => applyStrokeColorToEl(el, c), 'StrokeColor'),
    previewTextColor: (c: string) => previewStyle((el) => applyTextColorToEl(el, c)),
    commitTextColor: (c: string) => commitStyle((el) => applyTextColorToEl(el, c), 'TextColor'),
    // Border weight / pattern / radius tiles.
    previewBorderStroke: (v: BorderStroke) => previewStyle((el) => applyBorderStrokeToEl(el, v)),
    commitBorderStroke: (v: BorderStroke) =>
      commitStyle((el) => applyBorderStrokeToEl(el, v), 'BorderStroke'),
    previewBorderStyle: (v: BorderStyle) => previewStyle((el) => applyBorderStyleToEl(el, v)),
    commitBorderStyle: (v: BorderStyle) =>
      commitStyle((el) => applyBorderStyleToEl(el, v), 'BorderStyle'),
    previewBorderRadius: (v: BorderRadius) => previewStyle((el) => applyBorderRadiusToEl(el, v)),
    commitBorderRadius: (v: BorderRadius) =>
      commitStyle((el) => applyBorderRadiusToEl(el, v), 'BorderRadius'),
    // Shadow preset tiles (spec/86); `null` is the None tile. The sliders
    // stay on the debounced useColorStyleSetters path — only tiles preview.
    previewShadow: (v: ElementShadow | null) => previewStyle((el) => applyShadowToEl(el, v)),
    commitShadow: (v: ElementShadow | null) =>
      commitStyle((el) => applyShadowToEl(el, v), 'Shadow'),
    // Rotation angle tiles (fixed 45° steps).
    previewRotation: (deg: number) => previewStyle((el) => applyRotationToEl(el, deg)),
    commitRotation: (deg: number) => commitStyle((el) => applyRotationToEl(el, deg), 'Rotation'),
    // Shape morph tiles. Id-scoped: the single menu morphs the clicked
    // element only (not its group), the multi menu passes every morphable
    // member — so the ids come from the caller, not the resolved selection.
    previewShapeKind: (ids: string[], kind: ShapeKind) =>
      previewStyle((el) => applyShapeKindToEl(el, kind), new Set(ids)),
    commitShapeKind: (ids: string[], kind: ShapeKind) =>
      commitStyle((el) => applyShapeKindToEl(el, kind), 'ShapeMorph', new Set(ids)),
    // Tech-icon fixed tile size (spec/41).
    previewIconSize: (v: IconSize) => previewStyle((el) => applyIconSizeToEl(el, v)),
    commitIconSize: (v: IconSize) => commitStyle((el) => applyIconSizeToEl(el, v), 'IconSize'),
    // Status markers (spec/49) + their size row.
    previewMarker: (v: ShapeMarker | null) => previewStyle((el) => applyMarkerToEl(el, v)),
    commitMarker: (v: ShapeMarker | null) => commitStyle((el) => applyMarkerToEl(el, v), 'Marker'),
    previewMarkerSize: (v: TextSize) => previewStyle((el) => applyMarkerSizeToEl(el, v)),
    commitMarkerSize: (v: TextSize) =>
      commitStyle((el) => applyMarkerSizeToEl(el, v), 'MarkerSize'),
    // Text alignment 3×3 grid + text size tiles.
    previewTextAlign: (x: TextAlignX, y: TextAlignY) =>
      previewStyle((el) => applyTextAlignToEl(el, x, y)),
    commitTextAlign: (x: TextAlignX, y: TextAlignY) =>
      commitStyle((el) => applyTextAlignToEl(el, x, y), 'TextAlign'),
    previewTextSize: (v: TextSize) => previewStyle((el) => applyTextSizeToEl(el, v)),
    commitTextSize: (v: TextSize) => commitStyle((el) => applyTextSizeToEl(el, v), 'TextSize'),
    // Label font + box padding — same hover-preview / click-commit flow as the
    // text-size tiles above, for the element menu's Text flyout.
    previewFont: (v: string | null) => previewStyle((el) => applyFontToEl(el, v)),
    commitFont: (v: string | null) => commitStyle((el) => applyFontToEl(el, v), 'Font'),
    previewPadding: (v: Padding) => previewStyle((el) => applyPaddingToEl(el, v)),
    commitPadding: (v: Padding) => commitStyle((el) => applyPaddingToEl(el, v), 'Padding'),
    // Inline-icon placement (spec/09 icons). Id-scoped like shape morph.
    previewInlineIcon: (elementId: string, iconId: string, position: IconPosition) =>
      previewStyle((el) => applyInlineIconToEl(el, iconId, position), new Set([elementId])),
    commitInlineIcon: (elementId: string, iconId: string, position: IconPosition) =>
      commitStyle((el) => applyInlineIconToEl(el, iconId, position), 'Icon', new Set([elementId])),
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
