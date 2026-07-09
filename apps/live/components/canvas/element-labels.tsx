// Label rendering primitives used inside boxed element views (shape,
// text, sticky). Five renderers and two editors covering the four
// committed sizes (scale / sm / md / lg) and both single-line and
// multi-line layouts. Lifted out of element-parts.tsx (was 643 lines,
// two-thirds of it labels) so the parts file is scoped to selection
// chrome (lock badge, resize handles) and labels live with
// their own shared CSS / font tables.
//
// The split lines up cleanly: nothing in the selection-chrome half
// referenced any of these symbols (alignment constants, font tables,
// the label style type, the SVG preserveAspectRatio helper, the
// renderers themselves), and BoxedElementView was the single consumer
// of every exported label. The element-parts.tsx import block in
// BoxedElementView is split here in the same change.

import {
  hasRichFormatting,
  type BoxedElement,
  type Padding,
  type TextAlignX,
  type TextAlignY,
  type TextRun,
  type TextSize,
} from '@livediagram/diagram';
import { RichTextEditor } from '@/components/canvas/RichTextEditor';
import { FixedSizeLabel, MultilineLabel, RichLabel, ScalingLabel } from './element-label-views';

export function renderLabel(
  element: BoxedElement,
  label: string,
  textSize: TextSize,
  alignX: TextAlignX,
  alignY: TextAlignY,
  padding: number,
  isEditing: boolean,
  // Commits the edited label: the plain-text mirror plus the per-range
  // runs (spec/09). Runs are normalized + may be empty for plain text.
  onCommitLabel: (label: string, runs: TextRun[]) => void,
  onCancelEdit: () => void,
  editCursorAtEnd: boolean,
  // Canvas zoom, so the floating edit toolbar counter-scales to a constant
  // on-screen size inside the world transform.
  zoom: number,
  fontFamily?: string,
  // Whole-element alignment + padding setters surfaced in the edit toolbar
  // (spec/09). Operate on the current selection = the editing element.
  onSetAlign?: (x: TextAlignX, y: TextAlignY) => void,
  onSetPadding?: (padding: Padding) => void,
  // Whole-element font + size setters (the toolbar's Font submenu + the
  // Scale size option).
  onSetFont?: (font: string | null) => void,
  onSetTextSize?: (size: TextSize) => void,
  // When the element carries an inline icon or a status marker, the editor
  // renders as a flex child (not a full-box fill) so the glyph stays in its
  // place beside the text while typing; the inline-icon layout owns
  // positioning + padding.
  inlineIcon = false,
  // Text-native animation class (spec/09): applied to the label content node
  // so glow / pulse / trace / gradient ride the glyphs rather than the
  // element's invisible bounding box. Set only for text elements (see
  // isTextNativeAnim in BoxedElementView); undefined otherwise.
  labelAnimClass?: string,
) {
  const isSticky = element.type === 'sticky';
  // Shape elements don't carry a placeholder during edit. The user
  // is already mid-double-click on a visible shape, so the empty
  // input doesn't need "Label" filler nudging them; the surrounding
  // shape silhouette communicates context already. Sticky notes
  // and standalone text elements DO get a placeholder because their
  // pre-edit affordance is just an empty rectangle / nothing.
  const placeholder = element.type === 'text' ? 'Text' : isSticky ? 'Note' : '';

  const textStyle = {
    bold: element.textBold,
    italic: element.textItalic,
    underline: element.textUnderline,
    strikethrough: element.textStrikethrough,
    fontFamily,
  };

  const richText = (element as { richText?: TextRun[] }).richText;

  if (isEditing) {
    // Per-element placeholder colour: typed text inherits the element's
    // resolved textColor via currentColor (set on the parent view), so the
    // editor matches the committed label instead of snapping to a default.
    const textClass = isSticky
      ? 'text-amber-950'
      : element.type === 'text'
        ? 'placeholder:text-slate-400'
        : 'placeholder:text-brand-300';
    return (
      <RichTextEditor
        element={element}
        initialLabel={label}
        initialRuns={richText}
        placeholder={placeholder}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        fontFamily={fontFamily}
        multiline={isSticky}
        cursorAtEnd={editCursorAtEnd}
        zoom={zoom}
        textClassName={textClass}
        onCommit={onCommitLabel}
        onCancel={onCancelEdit}
        onSetAlign={onSetAlign}
        onSetPadding={onSetPadding}
        onSetFont={onSetFont}
        onSetTextSize={onSetTextSize}
        currentFont={(element as { font?: string }).font ?? null}
        inline={inlineIcon}
      />
    );
  }

  // Per-range formatting (spec/09): once a label carries non-trivial
  // runs, render them as styled spans regardless of size (the `scale`
  // auto-fit opt-out). Empty / single override-free runs fall through to
  // the legacy whole-element renderers below.
  if (hasRichFormatting(richText)) {
    return (
      <RichLabel
        runs={richText!}
        element={element}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        fontFamily={fontFamily}
        multiline={isSticky}
        className={isSticky ? 'text-amber-950' : ''}
        animClass={labelAnimClass}
      />
    );
  }

  if (isSticky) {
    return (
      <MultilineLabel
        text={label}
        placeholder={placeholder}
        textSize={textSize}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        className="text-amber-950"
        style={textStyle}
      />
    );
  }

  if (textSize === 'scale') {
    if (!label) return null;
    return (
      <ScalingLabel
        text={label}
        alignX={alignX}
        alignY={alignY}
        padding={padding}
        style={textStyle}
        // The gradient relies on background-clip:text, which can't paint an SVG
        // <text> fill — withhold it here so the glyphs don't vanish; glow /
        // pulse / trace ride the SVG drop-shadow fine.
        animClass={labelAnimClass === 'lvd-anim-text-gradient' ? undefined : labelAnimClass}
      />
    );
  }

  return (
    <FixedSizeLabel
      text={label}
      size={textSize}
      alignX={alignX}
      alignY={alignY}
      padding={padding}
      style={textStyle}
      animClass={labelAnimClass}
    />
  );
}
