import type { PendingDraw } from '@/lib/draw-mode';
import { IconButton } from '@/components/palette/palette-controls';

export { PaletteShapesTab } from './PaletteShapesTab';
export { PaletteToolsTab } from './PaletteToolsTab';

// Palette tab CONTENTS extracted from CommandPalette.tsx to keep that file under
// the ~1000-line budget. Each is the tile grid for one creation tab; the tiles
// call the editor's add* handlers (passed in) and highlight the pending
// draw-to-size intent. The search-driven tabs (Icons / Technology / Devices)
// stay inline in CommandPalette since they own the search/filter state.

export function PaletteComponentsTab({
  pendingDraw,
  addBanner,
  addHero,
  addHeader,
  addCallout,
  addStatRow,
  addProcess,
  onAddImage,
}: {
  pendingDraw: PendingDraw | null | undefined;
  addBanner: () => void;
  addHero: () => void;
  addHeader: () => void;
  addCallout: () => void;
  addStatRow: () => void;
  addProcess: () => void;
  onAddImage?: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      <IconButton
        label="Add banner"
        description="Banner. A themed title block (accent bar with a title and subtitle) to head your diagram. Tap to drop or drag to size; drops as a group you can recolour, retitle, or ungroup."
        onClick={addBanner}
        active={pendingDraw?.type === 'component' && pendingDraw.kind === 'banner'}
        noTint
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
          <path d="M7 10.75h10" strokeWidth="2.2" />
          <path d="M9 14.25h6" />
        </svg>
      </IconButton>
      <IconButton
        label="Add callout"
        description="Callout. A soft note box with an icon, title, and body for annotating a diagram. Tap to drop or drag to size."
        onClick={addCallout}
        active={pendingDraw?.type === 'component' && pendingDraw.kind === 'callout'}
        noTint
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
          <circle cx="7" cy="9" r="2" fill="currentColor" stroke="none" />
          <path d="M11 8.5h8M6 13h13M6 16h9" />
        </svg>
      </IconButton>
      <IconButton
        label="Add stat row"
        description="Stat row. Three KPI cards (big number + caption) for dashboards / summaries. Tap to drop or drag to size."
        onClick={addStatRow}
        active={pendingDraw?.type === 'component' && pendingDraw.kind === 'stat'}
        noTint
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="6" width="6" height="12" rx="1" />
          <rect x="9" y="6" width="6" height="12" rx="1" />
          <rect x="16" y="6" width="6" height="12" rx="1" />
          <path d="M3.5 10.5h3M10.5 10.5h3M17.5 10.5h3" />
        </svg>
      </IconButton>
      <IconButton
        label="Add process steps"
        description="Process steps. Numbered circles joined by arrows with captions, for flows. Tap to drop or drag to size."
        onClick={addProcess}
        active={pendingDraw?.type === 'component' && pendingDraw.kind === 'process'}
        noTint
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="5" cy="12" r="3" />
          <circle cx="12" cy="12" r="3" />
          <circle cx="19" cy="12" r="3" />
          <path d="M8 12h1M15 12h1" />
        </svg>
      </IconButton>
      {onAddImage ? (
        <IconButton
          label="Add hero"
          description="Hero. A large image with a title and supporting line on a themed caption card. Tap to drop or drag to size; double-click the image to set it."
          onClick={addHero}
          active={pendingDraw?.type === 'component' && pendingDraw.kind === 'hero'}
          noTint
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
            <path d="M2.5 14l5-4 4 3 3-2.5 7 5.5" />
            <path d="M7 17.5h10" strokeWidth="2.2" />
          </svg>
        </IconButton>
      ) : null}
      {onAddImage ? (
        <IconButton
          label="Add header"
          description="Header. A website-style bar with a circular avatar, brand title, and nav links. Tap to drop or drag to size; double-click the avatar to set it."
          onClick={addHeader}
          active={pendingDraw?.type === 'component' && pendingDraw.kind === 'header'}
          noTint
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
            <circle cx="7" cy="12" r="2.2" />
            <path d="M14 10.5h5M14 13.5h5" />
          </svg>
        </IconButton>
      ) : null}
    </div>
  );
}
