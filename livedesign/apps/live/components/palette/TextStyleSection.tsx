'use client';

// The Text Style section of a text's Text flyout (docs/specs/008-canvas/canvas-and-palette.md "Text styles"): one row
// per Write text style, each name set in its own weight and slant at a size that keeps the styles' order, with its
// size beside it, the way a word processor lists its styles. A row hover-previews the style on the canvas and a press
// switches the text to it, one undo step; the row of the style the text wears is pressed. A text whose size, weight
// or slant is its own wears none, so no row is pressed until one is picked.
import { Glyph, HoverCard } from '@livedesign/ui';
import { TEXT_PRESET_LIST, type TextPreset, type TextPresetId } from '@livedesign/design';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import {
  onMouseHover,
  useRevertOnUnmount,
} from '@liveworkspace/workbench/components/primitives/hover-preview';
import { useMenuItemProps } from '@liveworkspace/workbench/components/primitives/menu-item-props';

// What each style is for, for its row's hover card (the same words as its palette tile's).
const TEXT_STYLE_USE: Readonly<Record<TextPresetId, string>> = {
  title: 'The name at the top of a screen.',
  subtitle: 'A quieter line under a title.',
  heading: 'Starts a section.',
  subheading: 'Splits a section up.',
  paragraph: 'Body copy that wraps at its width.',
  quote: 'A line pulled out of the body.',
  caption: 'Small print for a picture, a field or a footer.',
};

// A style's name in the menu: 10 px for the smallest, a px more for every 4 px of the style's own size, so the list
// reads as the hierarchy it places without a Title outgrowing its row.
const PREVIEW_MIN_PX = 10;
const PREVIEW_STEP = 0.25;
export function textStylePreviewPx(preset: TextPreset): number {
  return Math.round(PREVIEW_MIN_PX + (preset.px - 12) * PREVIEW_STEP);
}

/** A style's size, weight and slant in words, for its hover card. */
export function textStyleSummary(preset: TextPreset): string {
  const look = preset.bold ? ', bold' : preset.italic ? ', italic' : '';
  const box = preset.wrapWidth ? `, wraps at ${preset.wrapWidth} px` : '';
  return `${preset.px} px${look}${box}. ${TEXT_STYLE_USE[preset.id]}`;
}

export function TextStyleSection({
  current,
  section,
  onSet,
  onPreview,
  onPreviewEnd,
}: {
  // The style the text wears (textPresetOfElement), or null.
  current: TextPresetId | null;
  section: { open: boolean; onToggle: () => void; flush?: boolean };
  onSet: (id: TextPresetId) => void;
  onPreview: (id: TextPresetId) => void;
  onPreviewEnd: () => void;
}) {
  // Closing the flyout or the menu under the pointer fires no pointerleave: revert a preview then too.
  useRevertOnUnmount(onPreviewEnd);
  return (
    <MenuAccordionSection title="Text Style" icon={<TextStyleGlyph />} {...section}>
      <div className="flex flex-col gap-0.5 px-2 py-1.5">
        {TEXT_PRESET_LIST.map((preset) => (
          <TextStyleRow
            key={preset.id}
            preset={preset}
            active={current === preset.id}
            onSet={onSet}
            onPreview={onPreview}
            onPreviewEnd={onPreviewEnd}
          />
        ))}
      </div>
    </MenuAccordionSection>
  );
}

function TextStyleRow({
  preset,
  active,
  onSet,
  onPreview,
  onPreviewEnd,
}: {
  preset: TextPreset;
  active: boolean;
  onSet: (id: TextPresetId) => void;
  onPreview: (id: TextPresetId) => void;
  onPreviewEnd: () => void;
}) {
  // In a command menu: one of a set, checked when the text wears it.
  const { inCommandMenu, itemProps } = useMenuItemProps({ checked: active, radio: true });
  return (
    <HoverCard block title={preset.name} description={textStyleSummary(preset)}>
      <button
        type="button"
        {...itemProps}
        aria-label={`${preset.name}, ${preset.px} px`}
        aria-pressed={inCommandMenu ? undefined : active}
        onClick={() => onSet(preset.id)}
        onPointerEnter={onMouseHover(() => onPreview(preset.id))}
        onPointerLeave={onMouseHover(onPreviewEnd)}
        className={`flex min-h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1 text-left transition ${
          active
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        <span
          className="leading-normal"
          style={{
            fontSize: textStylePreviewPx(preset),
            fontWeight: preset.bold ? 700 : 400,
            fontStyle: preset.italic ? 'italic' : 'normal',
          }}
        >
          {preset.name}
        </span>
        <span
          className={`shrink-0 text-[10px] font-medium tabular-nums ${
            active ? 'text-brand-700 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {preset.px}
        </span>
      </button>
    </HoverCard>
  );
}

// A large T over two lines of body text: a heading and the paragraph under it.
function TextStyleGlyph() {
  return (
    <Glyph size={16} units={16}>
      <path d="M2.5 3h7M6 3v6.5" />
      <path d="M11 6.5h2.5M11 9.5h2.5M2.5 12.5h11" />
    </Glyph>
  );
}
