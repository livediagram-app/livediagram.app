import {
  isBoxed,
  type Element,
  type Tab,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { hugsText, hugTextSize } from '@/lib/text-hug';
import { measureDrawnText } from '@/components/canvas/text-hug-measure';

type TextStyleSetterDeps = {
  currentSelectionIds: () => Set<string>;
  selectionPrimary: () => Element | null;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // The tab being edited, for its font. A text box that fits or wraps hugs its text through every
  // change to how it is drawn (docs/specs/007-editor/editor-modes.md "A text box's sizing").
  activeTab: Pick<Tab, 'font'>;
};

// The selection-wide label text setters (size / font / alignment + the
// bold / italic / underline / strikethrough toggles). All resolve the
// current selection and commit through the shared handles, so they live
// together off the main useElementStyle hook — the same split as
// useArrowStyleSetters / useShapeStyleSetters.
export function useTextStyleSetters({
  currentSelectionIds,
  selectionPrimary,
  commit,
  activeTab,
}: TextStyleSetterDeps) {
  // A text-metrics change, committed with every hugging text box it touched re-hugged to its text
  // in the same step.
  const commitHugging = (ids: Set<string>, map: (els: Element[]) => Element[]) => {
    const measure = measureDrawnText(activeTab.font);
    commit((els) =>
      map(els).map((el) =>
        ids.has(el.id) && hugsText(el) ? { ...el, ...hugTextSize(el, measure(el)) } : el,
      ),
    );
  };

  const setTextSizeSelected = (size: TextSize) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitHugging(ids, (els) =>
      els.map((el) => {
        if (!ids.has(el.id) || !(isBoxed(el) || el.type === 'arrow')) return el;
        // A picked size is the size: it replaces a Shift-resize scale.
        if (el.type === 'text') {
          const { textScale: _scale, ...rest } = el;
          void _scale;
          return { ...rest, textSize: size };
        }
        return { ...el, textSize: size };
      }),
    );
    track('Element', 'Changed', 'TextSize');
  };

  // Font (docs/specs/004-interface-design/fonts.md). Passing a font id sets it on every text-bearing
  // member of the selection; passing null clears the override so they
  // fall back to the tab's default font.
  const setFontSelected = (font: string | null) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commitHugging(ids, (els) =>
      els.map((el) => {
        if (!ids.has(el.id) || !(isBoxed(el) || el.type === 'arrow')) return el;
        if (!font) {
          const copy = { ...el };
          delete (copy as { font?: string }).font;
          return copy;
        }
        return { ...el, font };
      }),
    );
    track('Element', 'Changed', 'Font');
  };

  const setTextAlignSelected = (x: TextAlignX, y: TextAlignY) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && isBoxed(el) ? { ...el, textAlignX: x, textAlignY: y } : el,
      ),
    );
    track('Element', 'Changed', 'TextAlign');
  };

  // A lane title turned upright in its side strip, or back across (docs/specs/009-elements/lane.md
  // "Upright titles"). Lanes only; one commit.
  const setLaneUprightTitleSelected = (upright: boolean) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) => {
        if (!ids.has(el.id) || el.type !== 'shape' || el.shape !== 'lane') return el;
        if (upright) return { ...el, titleOrientation: 'upright' as const };
        const { titleOrientation: _turned, ...across } = el;
        void _turned;
        return across;
      }),
    );
    track('Element', 'Changed', 'LaneUprightTitle');
  };

  // Generic helper for the inline label styles. Each toggle flips the
  // matching boolean on every member of the current selection. We
  // derive the next value from the primary so a partially-applied
  // group all jumps to the same state.
  const toggleTextStyleSelected = (
    field: 'textBold' | 'textItalic' | 'textUnderline' | 'textStrikethrough',
  ) => {
    const primary = selectionPrimary();
    if (!primary || !(isBoxed(primary) || primary.type === 'arrow')) return;
    const next = !(primary[field] ?? false);
    const ids = currentSelectionIds();
    commitHugging(ids, (els) =>
      els.map((el) =>
        ids.has(el.id) && (isBoxed(el) || el.type === 'arrow')
          ? withTextStyle(el, field, next)
          : el,
      ),
    );
    // Telemetry type is the style name (Bold / Italic / Underline /
    // Strikethrough) — `field` minus its 'text' prefix, title-cased.
    track('Element', 'Toggled', field.replace(/^text/, ''));
  };
  return {
    setTextSizeSelected,
    setFontSelected,
    setTextAlignSelected,
    setLaneUprightTitleSelected,
    toggleTextStyleSelected,
  };
}

// One inline label style flipped. Bold clears a text's wordmark weight
// (docs/specs/007-editor/logo-pages.md "Wordmark type"), so the Bold button always shows its result.
export function withTextStyle<T extends Element>(
  el: T,
  field: 'textBold' | 'textItalic' | 'textUnderline' | 'textStrikethrough',
  next: boolean,
): T {
  const out = { ...el, [field]: next };
  if (field === 'textBold' && out.type === 'text')
    delete (out as { fontWeight?: number }).fontWeight;
  return out;
}
