// A page's icon drawn at one size (docs/specs/030-knowledgebase/page-surface.md "The page icon"): an emoji as the
// system's colour emoji font draws it, or a line-art catalogue icon in the text colour around it. Shared by the head
// left of the Title, the page tree's rows, the breadcrumb and the picker. Decorative: whoever shows it names the page.
import { memo } from 'react';
import type { TabIcon } from '@liveknowledge/document';
import { Glyph } from '@liveknowledge/ui';
import { IconPrims } from '@/components/primitives/icon-glyph';

export const EMOJI_FONT =
  "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif";

export const PageIconGlyph = memo(function PageIconGlyph({
  icon,
  size,
  className = '',
}: {
  icon: TabIcon;
  size: number;
  className?: string;
}) {
  if ('emoji' in icon)
    return (
      <span
        aria-hidden
        data-page-icon-glyph="emoji"
        className={`inline-flex shrink-0 select-none items-center justify-center leading-none ${className}`}
        // A colour emoji's box is about its font size; a touch smaller keeps it inside the square the icon holds.
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.86),
          fontFamily: EMOJI_FONT,
        }}
      >
        {icon.emoji}
      </span>
    );
  return (
    <span
      aria-hidden
      data-page-icon-glyph="icon"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <Glyph size={size} units={24}>
        <IconPrims iconId={icon.iconId} />
      </Glyph>
    </span>
  );
});
