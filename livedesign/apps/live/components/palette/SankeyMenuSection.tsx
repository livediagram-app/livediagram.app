'use client';

// The Sankey diagram's menu (docs/specs/009-elements/sankey.md "The menu"): one Sankey category whose flyout holds
// its sections, each closed until opened, as every section is. Flows: what it holds (flows, nodes, any hidden),
// Edit Flows, and each node's colour. Bands, Layout, Labels and Leftovers: one choice each. Text: the unit and the
// text size. Every pick commits at once, one undo step each, through the Sankey setters.

import { useMemo, type ComponentProps } from 'react';
import { Button } from '@livedesign/ui';
import {
  chartRamp,
  SANKEY_ALIGN_LABELS,
  SANKEY_ALIGNS,
  SANKEY_LINK_COLOR_LABELS,
  SANKEY_LEFTOVER_LABELS,
  SANKEY_LEFTOVER_NAME,
  SANKEY_LEFTOVERS,
  SANKEY_LINK_COLORS,
  SANKEY_NAME_MAX,
  SANKEY_UNIT_MAX,
  SANKEY_VALUE_LABEL_LABELS,
  SANKEY_VALUE_LABELS,
  sankeyGraph,
  sankeyLabelPx,
  sankeyNodeColor,
  type SankeyAlign,
  type SankeyLeftover,
  type SankeyLinkColor,
  type SankeyValueLabel,
  type ShapeElement,
  type TextSize,
} from '@livedesign/design';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { standardGroup } from '@/components/colour/colour-options';
import { useDesignColours } from '@/hooks/ui/useDesignColours';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { OptionRows } from '@/components/primitives/OptionRows';
import { LegendTextSize } from '@/components/palette/TypographySections';
import { DataMenuGlyph } from '@/components/palette/context-menu-rows';
import { MENU_ICON_PX } from '@/components/palette/context-menu-icons';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { lucideGlyph } from '@livedesign/ui';
import {
  lucideALargeSmall,
  lucideCoins,
  lucideColumns2,
  lucideHash,
  lucidePalette,
  lucideRoute,
} from '@liveworkspace/icons/lucide';
import { MENU_CELL_INPUT } from '@liveworkspace/workbench/components/palette/menu-editor-classes';
import type { SankeySetters } from '@/hooks/canvas/useSankeySetters';
import {
  AlignGlyph,
  BandGlyph,
  LeftoverGlyph,
  ValueGlyph,
} from '@/components/palette/sankey-menu-glyphs';

// The Display pickers are option lists (one choice to a row, its glyph at the left), inset like the menu's rows.
const LIST = 'mx-3 mt-1';

// The sections' icons.
const FlowsGlyph = lucideGlyph(lucideRoute, MENU_ICON_PX);
const BandsGlyph = lucideGlyph(lucidePalette, MENU_ICON_PX);
const LayoutGlyph = lucideGlyph(lucideColumns2, MENU_ICON_PX);
const LabelsGlyph = lucideGlyph(lucideHash, MENU_ICON_PX);
const LeftoversGlyph = lucideGlyph(lucideCoins, MENU_ICON_PX);
const TextGlyph = lucideGlyph(lucideALargeSmall, MENU_ICON_PX);

// What a node colour pick hands back to mean "back to the palette".
const PALETTE_PICK = 'sankey:palette';

export type SankeyMenuHandlers = {
  // The tab theme's ramp, so the swatches here match the nodes on the canvas.
  palette: readonly string[];
  onEditFlows: (elementId: string) => void;
  onSetNodeColor: SankeySetters['setSankeyNodeColorSelected'];
  onSetOption: SankeySetters['setSankeyOptionSelected'];
};

type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

export function SankeyMenuSections({
  target,
  handlers: h,
  sectionProps,
  flyoutProps,
  onPreviewTextSize,
  onPreviewEnd,
}: {
  target: ShapeElement;
  handlers: SankeyMenuHandlers;
  sectionProps: (id: string) => SectionProps;
  // The Sankey category's own row: open state and placement, as the host gives every flyout.
  flyoutProps: Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
  onPreviewTextSize: (size: TextSize) => void;
  onPreviewEnd: () => void;
}) {
  const graph = useMemo(() => sankeyGraph(target.sankeyFlows), [target.sankeyFlows]);
  const ramp = chartRamp(target.chartPalette, h.palette);
  const flows = target.sankeyFlows?.length ?? 0;
  const hidden = graph.skipped.length;
  const summary = [
    `${flows} ${flows === 1 ? 'flow' : 'flows'}`,
    `${graph.nodes.length} ${graph.nodes.length === 1 ? 'node' : 'nodes'}`,
    ...(hidden > 0 ? [`${hidden} hidden`] : []),
  ].join(' · ');
  const linkColor = target.sankeyLinkColor ?? 'gradient';
  const align = target.sankeyAlign ?? 'justify';
  const valueLabel = target.sankeyValueLabel ?? 'value';
  const leftover = target.sankeyLeftover ?? 'show';

  return (
    <MenuFlyoutSection title="Sankey" icon={<DataMenuGlyph />} {...flyoutProps}>
      <MenuAccordionSection title="Flows" icon={<FlowsGlyph />} {...sectionProps('sankey-flows')}>
        <div className="px-2 py-1.5">
          <p className="text-[11px] text-slate-600 dark:text-slate-300">{summary}</p>
          <Button
            variant="secondary"
            size="xs"
            className="mt-1.5 w-full"
            onClick={() => h.onEditFlows(target.id)}
          >
            Edit Flows
          </Button>
          {graph.nodes.length > 0 ? (
            <>
              <p className="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Nodes
              </p>
              <div className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto">
                {graph.nodes.map((n) => {
                  const own = sankeyNodeColor(target.sankeyNodes, n.name);
                  const shown = own ?? ramp[n.index % ramp.length]!;
                  return (
                    <NodeColourRow
                      key={n.name}
                      name={n.name}
                      own={own}
                      shown={shown}
                      paletteColour={ramp[n.index % ramp.length]!}
                      onPick={(color) => h.onSetNodeColor(n.name, color)}
                    />
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </MenuAccordionSection>
      <MenuAccordionSection title="Bands" icon={<BandsGlyph />} {...sectionProps('sankey-bands')}>
        <OptionRows
          kind="single"
          label="Bands"
          className={LIST}
          selected={linkColor}
          rows={SANKEY_LINK_COLORS.map((mode) => ({
            id: mode,
            label: SANKEY_LINK_COLOR_LABELS[mode],
            icon: <BandGlyph mode={mode} from={ramp[0]!} to={ramp[1 % ramp.length]!} />,
          }))}
          onPick={(id) => h.onSetOption({ sankeyLinkColor: id as SankeyLinkColor })}
        />
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Layout"
        icon={<LayoutGlyph />}
        {...sectionProps('sankey-layout')}
      >
        <OptionRows
          kind="single"
          label="Layout"
          className={LIST}
          selected={align}
          rows={SANKEY_ALIGNS.map((a) => ({
            id: a,
            label: SANKEY_ALIGN_LABELS[a],
            icon: <AlignGlyph align={a} />,
          }))}
          onPick={(id) => h.onSetOption({ sankeyAlign: id as SankeyAlign })}
        />
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Labels"
        icon={<LabelsGlyph />}
        {...sectionProps('sankey-labels')}
      >
        <OptionRows
          kind="single"
          label="Labels"
          className={LIST}
          selected={valueLabel}
          rows={SANKEY_VALUE_LABELS.map((v) => ({
            id: v,
            label: SANKEY_VALUE_LABEL_LABELS[v],
            icon: <ValueGlyph label={v} />,
          }))}
          onPick={(id) => h.onSetOption({ sankeyValueLabel: id as SankeyValueLabel })}
        />
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Leftovers"
        icon={<LeftoversGlyph />}
        {...sectionProps('sankey-leftovers')}
      >
        <OptionRows
          kind="single"
          label="Leftovers"
          className={LIST}
          selected={leftover}
          rows={SANKEY_LEFTOVERS.map((l) => ({
            id: l,
            label: SANKEY_LEFTOVER_LABELS[l],
            icon: <LeftoverGlyph leftover={l} color={ramp[0]!} />,
          }))}
          onPick={(id) => h.onSetOption({ sankeyLeftover: id as SankeyLeftover })}
        />
        {leftover === 'show' ? (
          <TextOptionRow
            label="Leftover Name"
            value={target.sankeyLeftoverName ?? ''}
            placeholder={SANKEY_LEFTOVER_NAME}
            maxLength={SANKEY_NAME_MAX}
            width="w-28"
            onSet={(name) => h.onSetOption({ sankeyLeftoverName: name })}
          />
        ) : null}
      </MenuAccordionSection>
      <MenuAccordionSection title="Text" icon={<TextGlyph />} {...sectionProps('sankey-text')}>
        <TextOptionRow
          label="Unit"
          value={target.sankeyUnit ?? ''}
          placeholder="£, kWh…"
          maxLength={SANKEY_UNIT_MAX}
          width="w-24"
          onSet={(u) => h.onSetOption({ sankeyUnit: u })}
        />
        <LegendTextSize
          current={target.textSize ?? 'md'}
          presetPx={sankeyLabelPx}
          onSet={(size) => h.onSetOption({ textSize: size })}
          onPreview={onPreviewTextSize}
          onPreviewEnd={onPreviewEnd}
        />
      </MenuAccordionSection>
    </MenuFlyoutSection>
  );
}

// A node's colour: its chip opens the one colour picker, led by "Palette", which hands the node back to the
// diagram's palette (only offered once it has a colour of its own).
function NodeColourRow({
  name,
  own,
  shown,
  paletteColour,
  onPick,
}: {
  name: string;
  own: string | undefined;
  shown: string;
  paletteColour: string;
  onPick: (color: string | undefined) => void;
}) {
  const yours = useDesignColours();
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200">
      <ColourSwatchButton
        label={`${name} colour`}
        value={own ?? null}
        swatch={shown}
        leading={own ? [{ id: PALETTE_PICK, colour: paletteColour, label: 'Palette' }] : []}
        standard={[standardGroup('strong', 'light', 'hex')]}
        yours={yours}
        className="h-5 w-5"
        onPick={(id) => onPick(id === PALETTE_PICK ? undefined : id)}
      >
        <span
          aria-hidden
          className="h-4 w-2.5 rounded-[2px] border border-slate-300 dark:border-slate-600"
          style={{ backgroundColor: shown }}
        />
      </ColourSwatchButton>
      <span className="truncate">{name}</span>
    </div>
  );
}

// A short text option (the unit, the leftover node's name), committed on Enter or blur.
function TextOptionRow({
  label,
  value,
  placeholder,
  maxLength,
  width,
  onSet,
}: {
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  width: string;
  onSet: (value: string) => void;
}) {
  const [draft, setDraft] = useFollowingDraft(value);
  const commit = () => {
    if (draft.trim() !== value) onSet(draft);
  };
  return (
    <div className="px-3 pt-2">
      <label className="flex items-center justify-between gap-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {label}
        <input
          className={`${MENU_CELL_INPUT} ${width}`}
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={label}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </label>
    </div>
  );
}
