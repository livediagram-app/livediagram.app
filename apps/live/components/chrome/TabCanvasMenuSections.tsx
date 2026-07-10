import type { ReactNode } from 'react';
import {
  MenuAccordionSection,
  MenuActionButton,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import {
  AutoAlignIcon,
  AutoLayoutMenuIcon,
  CanvasMenuIcon,
  CleanupMenuIcon,
  FlowDownMenuIcon,
  FlowRightMenuIcon,
  FontMenuIcon,
  MindmapMenuIcon,
  PaletteMenuIcon,
  TreeMenuIcon,
} from '@/components/palette/context-menu-icons';
import {
  AUTO_LAYOUT_CHOICES,
  AUTO_LAYOUT_STYLE_IDS,
  type AutoLayoutChoice,
} from '@/lib/auto-layout-choices';
import { FontSelect } from '@/components/palette/FontSelect';
import { SizeButton } from '@/components/palette/palette-controls';
import { DotsIcon, ScaleIcon } from '@/components/palette/palette-icons';
import type { CanvasMenuActions } from './TabBar';

// Tile glyph per explicit layout style (labels + behaviour live in
// AUTO_LAYOUT_CHOICES; only the icons are view-side).
const STYLE_ICONS: Record<Exclude<AutoLayoutChoice, 'smart'>, ReactNode> = {
  'flow-down': <FlowDownMenuIcon />,
  'flow-right': <FlowRightMenuIcon />,
  tree: <TreeMenuIcon />,
  mindmap: <MindmapMenuIcon />,
};

// The tab menu's canvas band (spec/09 + spec/28 + spec/47): the Look &
// Feel (theme / background), Font (tab default font + seeded size, with
// apply-to-all), and Cleanup (Auto Layout / Auto-align) accordion
// sections. Rendered by PortalMenu whenever canvas actions are
// available — both entry points (canvas right-click AND the active
// tab's ellipsis menu) show the same unified band. `sectionProps` is
// the parent's one-open-at-a-time accordion wiring, shared so these
// sections fold into the same exclusive set as the rest of the menu.
export function TabCanvasMenuSections({
  canvas,
  onClose,
  sectionProps,
}: {
  canvas: CanvasMenuActions;
  onClose: () => void;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  return (
    <>
      <MenuGroupSeparator />
      <MenuAccordionSection
        title="Look & Feel"
        icon={<CanvasMenuIcon />}
        {...sectionProps('canvas')}
      >
        <MenuTileGrid cols={2}>
          <MenuTile
            icon={<PaletteMenuIcon />}
            label="Change Theme"
            onClick={() => {
              canvas.onChangeTheme();
              onClose();
            }}
          />
          <MenuTile
            icon={<CanvasMenuIcon />}
            label="Change Canvas"
            onClick={() => {
              canvas.onChangeCanvas();
              onClose();
            }}
          />
        </MenuTileGrid>
      </MenuAccordionSection>
      {/* Font (spec/28): the tab's default font + the size seeded onto
            new elements. Moved out of the Tab Appearance modal so it
            sits with the other tab-appearance controls. Menu stays open
            while adjusting so several tweaks land in one visit. */}
      <MenuAccordionSection title="Font" icon={<FontMenuIcon />} {...sectionProps('font')}>
        <div className="flex flex-col gap-2 px-3 py-1.5">
          <FontSelect value={canvas.font} ariaLabel="Tab font" onChange={canvas.onSetFont} />
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                ['scale', 'Scale', <ScaleIcon key="s" />],
                ['sm', 'Small', <DotsIcon key="1" count={1} />],
                ['md', 'Medium', <DotsIcon key="2" count={2} />],
                ['lg', 'Large', <DotsIcon key="3" count={3} />],
              ] as const
            ).map(([size, label, glyph]) => (
              <SizeButton
                key={size}
                active={(canvas.defaultTextSize ?? 'md') === size}
                onClick={() => canvas.onSetDefaultTextSize(size)}
              >
                <span className="flex flex-col items-center gap-1 py-0.5">
                  {glyph}
                  <span className="text-[10px] font-medium">{label}</span>
                </span>
              </SizeButton>
            ))}
          </div>
          {/* Push the tab font + size onto everything already on the
                tab (clears per-element font overrides so they inherit). */}
          <MenuActionButton
            label="Apply to all elements"
            onClick={() => {
              canvas.onApplyFontToAll();
              onClose();
            }}
          />
        </div>
      </MenuAccordionSection>
      {/* ── Cleanup band: layout tidiers (spec/47). Auto-align grid-
            snaps; Auto Layout recomputes positions from the arrow graph,
            either smart (auto-detected flow) or in an explicit style
            (spec/47 "Layout styles"): flowchart down / right, tree,
            mindmap. */}
      <MenuGroupSeparator />
      <MenuAccordionSection title="Cleanup" icon={<CleanupMenuIcon />} {...sectionProps('cleanup')}>
        <MenuTileGrid cols={2}>
          <MenuTile
            icon={<AutoLayoutMenuIcon />}
            label={AUTO_LAYOUT_CHOICES.smart.menuLabel}
            onClick={() => {
              canvas.onAutoLayout();
              onClose();
            }}
          />
          <MenuTile
            icon={<AutoAlignIcon />}
            label="Auto-align"
            onClick={() => {
              canvas.onAutoAlign();
              onClose();
            }}
          />
          {AUTO_LAYOUT_STYLE_IDS.map((id) => (
            <MenuTile
              key={id}
              icon={STYLE_ICONS[id]}
              label={AUTO_LAYOUT_CHOICES[id].menuLabel}
              onClick={() => {
                canvas.onAutoLayout(id);
                onClose();
              }}
            />
          ))}
        </MenuTileGrid>
      </MenuAccordionSection>
    </>
  );
}
