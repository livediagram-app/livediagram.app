import type { ReactNode } from 'react';
import {
  MenuAccordionSection,
  MenuActionRow,
  MenuGroupSeparator,
} from '@/components/primitives/PortalMenu';
import {
  AutoAlignIcon,
  AutoLayoutMenuIcon,
  CleanupMenuIcon,
  FlowDownMenuIcon,
  FlowRightMenuIcon,
  MindmapMenuIcon,
  TreeMenuIcon,
} from '@/components/palette/context-menu-icons';
import {
  AUTO_LAYOUT_CHOICES,
  AUTO_LAYOUT_STYLE_IDS,
  type AutoLayoutChoice,
} from '@/lib/auto-layout-choices';
import { onMouseHover, useRevertOnUnmount } from '@/components/primitives/hover-preview';
import type { CleanupKind } from '@/lib/tab-cleanup';
import type { CanvasMenuActions } from './TabBar';

// Tile glyph per explicit layout style (labels + behaviour live in
// AUTO_LAYOUT_CHOICES; only the icons are view-side).
const STYLE_ICONS: Record<Exclude<AutoLayoutChoice, 'smart'>, ReactNode> = {
  'flow-down': <FlowDownMenuIcon />,
  'flow-right': <FlowRightMenuIcon />,
  tree: <TreeMenuIcon />,
  mindmap: <MindmapMenuIcon />,
};

// The tab menu's canvas band (spec/09 + spec/47): the Cleanup (Auto
// Layout / Auto-align) accordion. Paste sits in the toolbar above. Rendered by PortalMenu
// whenever canvas actions are available — both entry points (canvas
// right-click AND the active tab's ellipsis menu) show the same unified
// band. `sectionProps` is the parent's one-open-at-a-time accordion
// wiring, shared so these sections fold into the same exclusive set as
// the rest of the menu. The theme, canvas and font controls live in the
// Tab Look & Feel dialog (spec/42), reached from the paintbrush dock
// button, not here.
export function TabCanvasMenuSections({
  canvas,
  onClose,
  sectionProps,
}: {
  canvas: CanvasMenuActions;
  onClose: () => void;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  // Hovering a cleanup row lays the tab out behind the menu (spec/47). Mouse
  // pointers only, via onMouseHover: on touch a tap IS the commit, so a
  // preview would be a flicker nobody asked for.
  const hover = (kind: CleanupKind) => ({
    onPointerEnter: onMouseHover(() => canvas.onPreviewCleanup(kind)),
    onPointerLeave: onMouseHover(canvas.onEndCleanupPreview),
  });
  // The menu can close, or the section collapse, with the pointer still over a
  // row, and pointerleave does not fire on unmount.
  useRevertOnUnmount(canvas.onEndCleanupPreview);
  return (
    <>
      {/* ── Cleanup band: layout tidiers (spec/47). Auto-align grid-
            snaps; Auto Layout recomputes positions from the arrow graph,
            either smart (auto-detected flow) or in an explicit style
            (spec/47 "Layout styles"): flowchart down / right, tree,
            mindmap. */}
      <MenuGroupSeparator />
      <MenuAccordionSection title="Cleanup" icon={<CleanupMenuIcon />} {...sectionProps('cleanup')}>
        {/* One verb per row, icon on the left: six tidiers in a two-column
            grid read in two directions, and "Flowchart ↓" beside
            "Flowchart →" was easy to mix up. */}
        <MenuActionRow
          plain
          icon={<AutoLayoutMenuIcon />}
          label={AUTO_LAYOUT_CHOICES.smart.menuLabel}
          {...hover('smart')}
          onClick={() => {
            // End the preview FIRST: its revert and the command's commit are
            // two updaters in one React batch, so they compose in this order
            // and undo lands on the layout the author actually had.
            canvas.onEndCleanupPreview();
            canvas.onAutoLayout();
            onClose();
          }}
        />
        <MenuActionRow
          plain
          icon={<AutoAlignIcon />}
          label="Auto-align"
          {...hover('align')}
          onClick={() => {
            canvas.onEndCleanupPreview();
            canvas.onAutoAlign();
            onClose();
          }}
        />
        {AUTO_LAYOUT_STYLE_IDS.map((id) => (
          <MenuActionRow
            key={id}
            plain
            icon={STYLE_ICONS[id]}
            label={AUTO_LAYOUT_CHOICES[id].menuLabel}
            {...hover(id)}
            onClick={() => {
              canvas.onEndCleanupPreview();
              canvas.onAutoLayout(id);
              onClose();
            }}
          />
        ))}
      </MenuAccordionSection>
    </>
  );
}
