'use client';

// A logo page's own title-bar controls (docs/specs/007-editor/logo-pages.md "Beside the cog"),
// before its cog, each the cog's size with a tooltip: Mirror (pressed while on; opens its popover,
// LogoMirrorPopover) and Guides (pressed while the page shows them; opens LogoGuidesPopover).
import { lucideGrid3x3 } from '@livepages/icons/lucide';
import { lucideGlyph } from '@livepages/ui';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { MirrorAxisGlyph } from './logo-glyphs';
import { LogoMirrorButton } from './LogoMirrorPopover';
import { LogoGuidesButton } from './LogoGuidesPopover';
import { titleButtonClass } from './TitlePopoverButton';

const GuidesIcon = lucideGlyph(lucideGrid3x3, 14);

// The title-bar room each control takes (24 px and the gap), so the page's label truncates first;
// each named beside its icon takes this much on a desktop.
const BUTTON_ROOM = 28;
const LABELLED_ROOM = 72;

/** The room the controls take: Mirror and Guides, named on a desktop. */
export function logoTitleBarRoom(labelled: boolean): number {
  return 2 * (labelled ? LABELLED_ROOM : BUTTON_ROOM);
}

export function LogoTitleBar({
  pageId,
  tools,
  labelled: named,
}: {
  pageId: string;
  tools: LogoToolsView;
  // Whether the title bar has room to name them (CanvasPages); absent, a desktop does.
  labelled?: boolean;
}) {
  // Mirror and Guides name themselves on a desktop with room; a phone keeps them icon-only.
  const desktop = !useIsMobileViewport();
  const labelled = named ?? desktop;
  return (
    <div
      // Show Me on this page points at its Mirror and Guides (logo-pages.md "Show Me").
      data-logo-title-bar={pageId}
      className="pointer-events-auto flex items-center gap-1"
      // A press here is the controls', never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Mirror opens its popover: on or off, axis, copies, merge. */}
      <LogoMirrorButton
        pageId={pageId}
        tools={tools}
        labelled={labelled}
        className={titleButtonClass}
      >
        <MirrorAxisGlyph axis={tools.mirrorSettings(pageId).axis} size={14} />
      </LogoMirrorButton>
      {/* Guides opens its popover: Show Guides for this page, which guides, how strong. */}
      <LogoGuidesButton
        pageId={pageId}
        tools={tools}
        labelled={labelled}
        className={titleButtonClass}
      >
        <GuidesIcon />
      </LogoGuidesButton>
    </div>
  );
}
