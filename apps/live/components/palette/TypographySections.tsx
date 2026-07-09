'use client';

import type { ReactNode } from 'react';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { FontGlyph } from '@/components/canvas/rich-text-toolbar-icons';
import { DotsIcon, NonePaddingIcon, PaddingIcon, ScaleIcon } from './palette-icons';
import { FONTS, resolveFontStack } from '@/lib/fonts';
import type { Padding, TextSize } from '@livediagram/diagram';

// The typography controls — Font / Size / Padding — as three collapsible
// accordion sections, used by the element context menus' "Text" flyouts
// (single + multi selection) so both offer the same options with one
// implementation.
//
// The caller supplies the accordion open/close via `sectionProps(id)` (its own
// at-most-one-open state), the current values for the active-tile highlight,
// and the setters.

const TEXT_SIZE_OPTIONS: { key: TextSize; label: string; icon: ReactNode }[] = [
  { key: 'scale', label: 'Scale', icon: <ScaleIcon /> },
  { key: 'sm', label: 'Small', icon: <DotsIcon count={1} /> },
  { key: 'md', label: 'Medium', icon: <DotsIcon count={2} /> },
  { key: 'lg', label: 'Large', icon: <DotsIcon count={3} /> },
];

const TEXT_PADDING_OPTIONS: { key: Padding; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'sm', label: 'Small' },
  { key: 'md', label: 'Medium' },
  { key: 'lg', label: 'Large' },
];

type AccordionProps = {
  open: boolean;
  onToggle: () => void;
  flush?: boolean;
};

export function TypographySections({
  currentFont,
  currentSize,
  padding,
  onSetFont,
  onSetSize,
  onSetPadding,
  sectionProps,
  onPreviewFont,
  onPreviewSize,
  onPreviewPadding,
  onPreviewEnd,
}: {
  currentFont: string | null;
  // null = mixed / unset (no tile highlighted), e.g. a multi-run text selection.
  currentSize: TextSize | null;
  padding: Padding;
  onSetFont: (font: string | null) => void;
  onSetSize: (size: TextSize) => void;
  onSetPadding: (padding: Padding) => void;
  sectionProps: (id: string) => AccordionProps;
  // Optional hover-preview handlers (the element menus wire them).
  onPreviewFont?: (font: string | null) => void;
  onPreviewSize?: (size: TextSize) => void;
  onPreviewPadding?: (padding: Padding) => void;
  onPreviewEnd?: () => void;
}) {
  // Build the mouse-only hover handlers for a tile, or undefined when no
  // preview handler was supplied (so touch never leaves a preview stuck).
  const hover = <T,>(preview: ((v: T) => void) | undefined, value: T) =>
    preview
      ? {
          onPointerEnter: onMouseHover(() => preview(value)),
          onPointerLeave: onMouseHover(() => onPreviewEnd?.()),
        }
      : {};
  return (
    <>
      <MenuAccordionSection title="Font" icon={<FontGlyph />} {...sectionProps('font')}>
        <MenuTileGrid cols={2}>
          {FONTS.map((f) => (
            // No "Aa" swatch — the tile IS the font name rendered in its own
            // face, which is both a truer preview and more compact.
            <MenuTile
              key={f.id}
              active={currentFont === f.id}
              label={f.label}
              labelStyle={{ fontFamily: resolveFontStack(f.id) }}
              {...hover(onPreviewFont, f.id)}
              onClick={() => onSetFont(f.id)}
            />
          ))}
        </MenuTileGrid>
      </MenuAccordionSection>
      <MenuAccordionSection title="Size" icon={<DotsIcon count={2} />} {...sectionProps('size')}>
        <MenuTileGrid cols={2}>
          {TEXT_SIZE_OPTIONS.map((s) => (
            <MenuTile
              key={s.key}
              active={currentSize === s.key}
              label={s.label}
              icon={s.icon}
              {...hover(onPreviewSize, s.key)}
              onClick={() => onSetSize(s.key)}
            />
          ))}
        </MenuTileGrid>
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Padding"
        icon={padding === 'none' ? <NonePaddingIcon /> : <PaddingIcon size={padding} />}
        {...sectionProps('padding')}
      >
        <MenuTileGrid cols={2}>
          {TEXT_PADDING_OPTIONS.map((p) => (
            <MenuTile
              key={p.key}
              active={padding === p.key}
              label={p.label}
              icon={p.key === 'none' ? <NonePaddingIcon /> : <PaddingIcon size={p.key} />}
              {...hover(onPreviewPadding, p.key)}
              onClick={() => onSetPadding(p.key)}
            />
          ))}
        </MenuTileGrid>
      </MenuAccordionSection>
    </>
  );
}
