'use client';

// The Tools flyout's behaviour sections (docs/specs/008-canvas/canvas-and-palette.md): a mode button's mode, a
// portal's far end, a session button's tool, a reveal zone, a picker's source and a reaction pad's burst. Split
// out of ElementDataSections, which renders it in the same place in the flyout.

import type { ButtonMode, ShapeElement } from '@livediagram/document';
import { BUTTON_MODES } from '@livediagram/document';
import {
  EraserIcon,
  FormatPainterIcon,
  IsometricIcon,
  LaserIcon,
  PanIcon,
  SelectIcon,
  SpotlightIcon,
} from '@/components/palette/palette-icons';
import { MODE_LABEL } from '@/components/canvas/ModeButtonFace';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { PortalMenuSection } from '@/components/palette/PortalMenuSection';
import {
  PickerMenuSection,
  ReactionMenuSection,
  RevealMenuSection,
  SessionMenuSection,
} from '@/components/palette/BehaviourMenuSections';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from '@liveworkspace/workbench/components/palette/useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The mode tiles' glyphs: the palette picker's own icons, so a button's
// configured mode is recognisable from the same artwork everywhere (docs/specs/009-elements/mode-button.md).
const MODE_TILE_ICON: Record<ButtonMode, React.ReactNode> = {
  select: <SelectIcon />,
  pan: <PanIcon />,
  laser: <LaserIcon />,
  spotlight: <SpotlightIcon />,
  eraser: <EraserIcon />,
  format: <FormatPainterIcon />,
  isometric: <IsometricIcon />,
};

export function ElementBehaviourToolSections({
  props,
  shapeTarget,
  isModeButton,
  isPortal,
  isSessionButton,
  isReveal,
  isPicker,
  isReactionPad,
  sectionProps,
}: {
  props: EditorContextMenuProps;
  shapeTarget: ShapeElement | null;
  isModeButton: boolean;
  isPortal: boolean;
  isSessionButton: boolean;
  isReveal: boolean;
  isPicker: boolean;
  isReactionPad: boolean;
  sectionProps: Scaffold['sectionProps'];
}) {
  return (
    <>
      {/* Mode button (docs/specs/009-elements/mode-button.md): which selection mode pressing it hands
        whoever clicked. Tiles rather than a list so the icons match the
        palette's own mode picker. */}
      {isModeButton ? (
        <MenuAccordionSection
          title="Button"
          icon={<ToolsMenuGlyph />}
          {...sectionProps('button-mode')}
        >
          <p className="px-3 pt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Switches the presser to
          </p>
          <MenuTileGrid cols={3}>
            {BUTTON_MODES.map((mode) => (
              <MenuTile
                key={mode}
                icon={MODE_TILE_ICON[mode]}
                label={MODE_LABEL[mode]}
                active={shapeTarget?.mode === mode}
                onClick={() => props.onSetButtonMode(mode)}
              />
            ))}
          </MenuTileGrid>
        </MenuAccordionSection>
      ) : null}
      {/* Portal (docs/specs/009-elements/portal-element.md): its name, where it leads (any tab), and a
        shortcut to create the far end. See PortalMenuSection. */}
      {isPortal && shapeTarget ? (
        <PortalMenuSection
          portal={shapeTarget}
          tabs={props.tabs}
          activeTabId={props.activeTabId}
          onSetPortalTarget={props.onSetPortalTarget}
          onSetPortalName={props.onSetPortalName}
          onCreateLinkedPortal={props.onCreateLinkedPortal}
          sectionProps={sectionProps('portal-target')}
        />
      ) : null}
      {/* Session button (docs/specs/012-collaboration/session-button.md): which tool a press starts, and its
        one setting. See BehaviourMenuSections. */}
      {isSessionButton && shapeTarget && props.onSetSession ? (
        <SessionMenuSection
          element={shapeTarget}
          onSetSession={props.onSetSession}
          sectionProps={sectionProps('session')}
        />
      ) : null}
      {/* Reveal zone (docs/specs/009-elements/reveal-zone.md): off for everyone, or back on. */}
      {isReveal && shapeTarget && props.onSetRevealed ? (
        <RevealMenuSection
          element={shapeTarget}
          onSetRevealed={props.onSetRevealed}
          sectionProps={sectionProps('reveal')}
        />
      ) : null}
      {/* Picker (docs/specs/012-collaboration/picker.md): where it draws candidates from. */}
      {isPicker && shapeTarget ? (
        <PickerMenuSection
          element={shapeTarget}
          onSetPickerSource={props.onSetPickerSource}
          onSetPickerOptions={props.onSetPickerOptions}
          sectionProps={sectionProps('picker')}
        />
      ) : null}
      {/* Reaction pad (docs/specs/009-elements/reaction-pad.md): which burst it throws. */}
      {isReactionPad && shapeTarget ? (
        <ReactionMenuSection
          element={shapeTarget}
          onSetReaction={props.onSetReaction}
          sectionProps={sectionProps('reaction')}
        />
      ) : null}
    </>
  );
}
