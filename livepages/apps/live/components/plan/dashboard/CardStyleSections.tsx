'use client';

// The Style row of a Utility's Slot Settings cog (docs/specs/026-plan/plan-tabs.md "Card style"): the element menu's own
// Style flyout (ElementAppearanceSections), offering what a card in a slot can take. Presets (the shapes' looks, drawn
// for the tab's theme, with a hover preview and Reset to Default), Colours (Text, Background, Border, Reset to
// Theme), Border (Strength and Pattern; the corners stay the Dashboard's) and Shadow. A Title, drawn bare on the page,
// takes its text colour alone, so its flyout holds Colours only and is promoted inline (MenuFlyoutSection). Nothing a
// card in a slot cannot use: no Layer, Size, Rotation, Animation, Tools, Collaborate or Resources.
import { useState } from 'react';
import {
  themePresetColors,
  type BorderStroke,
  type BorderStyle,
  type DashboardStyledType,
  type ElementShadow,
} from '@livepages/document';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { MenuAccordionSection, MenuActionButton } from '@/components/primitives/PortalMenu';
import {
  BorderColourIcon,
  BorderGlyph,
  FillColourIcon,
  PaletteMenuIcon,
  PresetsMenuGlyph,
  StyleMenuGlyph,
  TextColourIcon,
} from '@/components/palette/context-menu-icons';
import { ShapePresets } from '@/components/palette/StylePresets';
import { ColourRow } from '@/components/palette/context-menu-rows';
import { BorderControls } from '@/components/palette/BorderControls';
import { ShadowSection } from '@/components/palette/ShadowSection';
import { useViewerAppearance, type CardStyle } from './useCardStyle';

// The slot card's own look (DashboardSlotView SLOT_CARD), as the colour rows show it before anything is set.
const CARD_DEFAULTS = {
  light: { text: '#1e293b', fill: '#ffffff', stroke: '#e2e8f0' },
  dark: { text: '#f1f5f9', fill: '#0f172a', stroke: '#334155' },
} as const;
// The Dashboard's soft lift as the shadow sliders read it before a shadow is set.
const CARD_SHADOW: ElementShadow = { offsetX: 0, offsetY: 12, blur: 32, opacity: 0.12 };

export function CardStyleSections({
  type,
  card,
  onClose,
}: {
  type: DashboardStyledType;
  card: CardStyle;
  onClose: () => void;
}) {
  const [flyout, setFlyout] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const [colour, setColour] = useState<string | null>(null);
  const appearance = useViewerAppearance();
  const sectionProps = (id: string) => ({
    open: section === id,
    onToggle: () => setSection((s) => (s === id ? null : id)),
    flush: true,
  });
  const colourProps = (id: string) => ({
    open: colour === id,
    onToggle: () => setColour((c) => (c === id ? null : id)),
  });
  const palette = { presets: themePresetColors(card.theme) };
  const defaults = CARD_DEFAULTS[appearance];
  const { look, shown, presets } = card;
  const preset = presets.find((p) => p.id === shown?.preset);
  const bare = type === 'title';
  const colourRow = (
    field: 'text' | 'fill' | 'stroke',
    label: string,
    icon: React.ReactNode,
    value: string,
  ) => (
    <ColourRow
      label={label}
      icon={icon}
      tone={field === 'fill' ? 'soft' : 'strong'}
      value={value}
      onChange={(c) => card.change({ [field]: c })}
      onCommit={(c) => card.change({ [field]: c })}
      onPreview={(c) => card.preview({ [field]: c })}
      onPreviewEnd={card.endPreview}
      {...colourProps(field)}
      {...palette}
    />
  );
  return (
    <MenuFlyoutSection
      title="Style"
      icon={<StyleMenuGlyph />}
      open={flyout}
      onToggle={() => setFlyout((f) => !f)}
      flush
    >
      {bare ? null : (
        <MenuAccordionSection
          title="Presets"
          icon={<PresetsMenuGlyph />}
          {...sectionProps('presets')}
        >
          <ShapePresets
            shape="square"
            colorPresets={presets}
            current={{ colorPreset: card.style?.preset }}
            // A preset is a whole look: its colours and border replace any set by hand; the shadow stays.
            onApplyColor={(p) => card.replace({ preset: p.id, shadow: card.style?.shadow })}
            onPreviewColor={(p) =>
              card.previewReplace({ preset: p.id, shadow: card.style?.shadow })
            }
            onPreviewEnd={card.endPreview}
            onReset={() => {
              card.replace(undefined);
              onClose();
            }}
          />
        </MenuAccordionSection>
      )}
      <MenuAccordionSection title="Colours" icon={<PaletteMenuIcon />} {...sectionProps('colours')}>
        {colourRow('text', 'Text', <TextColourIcon />, look.ink ?? defaults.text)}
        {bare
          ? null
          : colourRow('fill', 'Background', <FillColourIcon />, look.fill ?? defaults.fill)}
        {bare
          ? null
          : colourRow('stroke', 'Border', <BorderColourIcon />, look.stroke ?? defaults.stroke)}
        <div className="px-2 pb-1 pt-1.5">
          <MenuActionButton
            label="Reset to Theme"
            onClick={() => {
              card.change({
                preset: undefined,
                fill: undefined,
                stroke: undefined,
                text: undefined,
              });
              onClose();
            }}
          />
        </div>
      </MenuAccordionSection>
      {bare ? null : (
        <MenuAccordionSection title="Border" icon={<BorderGlyph />} {...sectionProps('border')}>
          <BorderControls
            strokeWidth={shown?.borderWidth ?? preset?.borderStroke ?? 'thin'}
            strokeStyle={shown?.borderStyle ?? preset?.borderStyle ?? 'solid'}
            radius={null}
            onCommitBorderStroke={(v: BorderStroke) => card.change({ borderWidth: v })}
            onPreviewBorderStroke={(v: BorderStroke) => card.preview({ borderWidth: v })}
            onCommitBorderStyle={(v: BorderStyle) => card.change({ borderStyle: v })}
            onPreviewBorderStyle={(v: BorderStyle) => card.preview({ borderStyle: v })}
            onCommitBorderRadius={() => {}}
            onPreviewBorderRadius={() => {}}
            onPreviewStyleEnd={card.endPreview}
          />
        </MenuAccordionSection>
      )}
      {bare ? null : (
        <ShadowSection
          shadow={shown?.shadow === 'none' ? undefined : (shown?.shadow ?? CARD_SHADOW)}
          section={sectionProps('shadow')}
          onSetShadow={(s) => card.drag({ shadow: s ?? 'none' })}
          onCommitPreset={(s) => card.change({ shadow: s ?? 'none' })}
          onPreviewPreset={(s) => card.preview({ shadow: s ?? 'none' })}
          onPreviewEnd={card.endPreview}
        />
      )}
    </MenuFlyoutSection>
  );
}
