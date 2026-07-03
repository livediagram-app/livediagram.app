import {
  isBoxed,
  type Element,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

type TextStyleSetterDeps = {
  currentSelectionIds: () => Set<string>;
  selectionPrimary: () => Element | null;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
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
}: TextStyleSetterDeps) {
  const setTextSizeSelected = (size: TextSize) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (isBoxed(el) || el.type === 'arrow') ? { ...el, textSize: size } : el,
      ),
    );
    track('Element', 'Changed', 'TextSize');
  };

  // Font (spec/28). Passing a font id sets it on every text-bearing
  // member of the selection; passing null clears the override so they
  // fall back to the tab's default font.
  const setFontSelected = (font: string | null) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((els) =>
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
    commit((els) =>
      els.map((el) =>
        ids.has(el.id) && (isBoxed(el) || el.type === 'arrow') ? { ...el, [field]: next } : el,
      ),
    );
    // Telemetry type is the style name (Bold / Italic / Underline /
    // Strikethrough) — `field` minus its 'text' prefix, title-cased.
    track('Element', 'Toggled', field.replace(/^text/, ''));
  };
  return { setTextSizeSelected, setFontSelected, setTextAlignSelected, toggleTextStyleSelected };
}
