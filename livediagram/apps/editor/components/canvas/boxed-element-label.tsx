// A boxed element's label and what lays it out (BoxedElementView): its inline icon and status marker, the looping
// animation's surfaces, an icon's caption band, an upright lane title's frame, a text box's hug, a mind node's fit,
// the indicators and the Text animation, and the label node itself. A hook, so the React Compiler memoises each part
// on what it reads, as it did inline; its hooks run in the order they did there.
import {
  PADDING_PX,
  defaultPadding,
  isSelfDrawingShape,
  isUprightTitle,
  uprightTitleStrip,
  type ShapeMarker,
  type TextAlignX,
  type TextAlignY,
  type TextSize,
} from '@livediagram/document';
import { renderLabel } from '@/components/canvas/element-labels';
import { uprightTitleFrame } from '@/components/canvas/upright-title';
import { captionBandAlignY, captionBandClass } from '@/components/primitives/icon-band';
import { useTextHug } from '@/components/canvas/useTextHug';
import { useMindLabelFit } from '@/components/canvas/useMindLabelFit';
import { useElementIndicators } from '@/components/canvas/useElementIndicators';
import { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { useLabelTextAnimation } from '@/components/canvas/useTextAnimation';
import type { BoxedElementViewProps } from './BoxedElementView.types';

// What BoxedElementView works out for its label, handed down as it is.
export type BoxedLabelLocals = {
  label: string;
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  textColor: string;
  cornerPx: number;
};

export function useBoxedLabel(
  {
    element,
    isEditing,
    editCursorAtEnd = false,
    fontFamily,
    onCommitLabel,
    onCancelEdit,
    onSetTextAlign,
    onFollowLink,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    tabSummaries,
  }: BoxedElementViewProps,
  { label, textSize, alignX, alignY, textColor, cornerPx }: BoxedLabelLocals,
) {
  // An inline icon sits beside the label on a regular shape (the
  // dedicated 'icon' shape kind has its own glyph-above-caption render
  // above and is excluded here). Computed before the label so the editor
  // can render as a flex child (keeping the icon visible while typing).
  const inlineIcon = element.type === 'shape' && element.shape !== 'icon' && element.iconId;
  // A status marker (docs/specs/009-elements/shape-markers.md) sits just left of the label (or centred when the
  // shape has no label). Progress shapes render their own centred percentage,
  // so they skip it. Shares the icon+label flex layout below.
  const marker: ShapeMarker | undefined =
    element.type === 'shape' && !isSelfDrawingShape(element.shape) ? element.marker : undefined;
  // Which surface each looping animation rides (wrapper box vs text
  // glyphs vs SVG outline), the pop-in entry class, and the CSS custom
  // properties the keyframes read (docs/specs/008-canvas/canvas-and-palette.md); see useBoxedElementAnimation.
  const { labelAnimClass, artAnimClass, svgAnim, wrapperAnimClass, animStyle, layer, layerAnim } =
    useBoxedElementAnimation(element, textColor);

  // An icon element's caption is confined to its own band, the complement
  // of the glyph band (docs/specs/010-palette/technology-icons.md, iconCaptionBand), so the text can never
  // stack over the art. The label renders with the band's INTERNAL vertical
  // anchor (side captions centre on the glyph's row) and the JSX below wraps
  // it in the band container.
  const iconCaptionBand =
    element.type === 'shape' && element.shape === 'icon' ? captionBandClass(alignX, alignY) : null;

  // An upright lane title turns in its strip; inside the turned frame it reads along the strip,
  // centred across it (docs/specs/009-elements/lane.md "Upright titles").
  const uprightStrip =
    element.type === 'shape' && element.shape === 'lane' && isUprightTitle(element)
      ? uprightTitleStrip(element, element.width, element.height)
      : null;
  const labelFrame = uprightStrip ? uprightTitleFrame(uprightStrip) : null;

  // A whiteboard text box hugs its text, growing with it while typed (useTextHug).
  const textHug = useTextHug(element, isEditing, fontFamily);
  // A mind node grows taller with its label's lines while typed (useMindLabelFit).
  const mindFit = useMindLabelFit(element, isEditing, fontFamily);

  const labelPadding = uprightStrip
    ? // A one-line strip has no room for a roomy padding across it.
      Math.min(PADDING_PX.sm, PADDING_PX[element.padding ?? defaultPadding(element)])
    : PADDING_PX[element.padding ?? defaultPadding(element)];
  // The element's indicators, placed before the label so the content can move out of their way.
  const indicators = useElementIndicators(
    element,
    { onFollowLink, onOpenComments, onOpenAction, onOpenNote, tabSummaries },
    { text: label, textSize, padding: labelPadding, alignX, alignY, inlineIcon: !!inlineIcon },
    cornerPx,
  );

  // The Text animation on the label's words (docs/specs/028-animation/element-animations.md).
  const textAnim = useLabelTextAnimation(element, label, textColor, isEditing);

  // The text label, computed once so the freehand branch, the plain
  // shape branch, and the inline-icon layout below all share it.
  const labelNode = renderLabel(
    element,
    label,
    textSize,
    uprightStrip ? uprightStrip.alongAlign : alignX,
    uprightStrip ? 'middle' : iconCaptionBand ? captionBandAlignY(alignX, alignY) : alignY,
    labelPadding,
    isEditing,
    (next, runs) => onCommitLabel(element.id, next, runs),
    onCancelEdit,
    editCursorAtEnd,
    fontFamily,
    onSetTextAlign,
    // Inline (flex-child) editor whenever the label shares its box with a
    // sibling glyph: an inline icon OR a status marker (docs/specs/009-elements/shape-markers.md). A
    // marker-only shape still lays out through ShapeInlineIconLayout, and
    // a full-box editor there contributes no flex width, so the marker
    // centred alone on top of the text while editing.
    !!inlineIcon || !!marker,
    labelAnimClass,
    textHug.label,
    textAnim,
    mindFit.onLiveText,
  );

  return {
    inlineIcon,
    marker,
    artAnimClass,
    svgAnim,
    wrapperAnimClass,
    animStyle,
    layer,
    layerAnim,
    iconCaptionBand,
    labelFrame,
    textHug,
    mindFit,
    indicators,
    labelNode,
  };
}
