// What the Toolbar layout's Palette (ToolbarPalette.tsx, docs/specs/007-editor/toolbar-layout.md) is handed.
// Split out of ToolbarPalette.tsx.
import type { ReactNode } from 'react';
import type { Element, Page } from '@livedesign/design';
import type { PaletteProps } from './palette.types';
import type { PaletteAddHandlers } from './palette-add-handlers';

export type ToolbarPaletteProps = Pick<
  PaletteProps,
  'canvasTool' | 'onSetCanvasTool' | 'onToggleZen' | 'canvasEmpty' | 'pendingDraw' | 'themeTint'
> &
  PaletteAddHandlers & {
    // The chrome is hidden (zen, the welcome flow). Hidden rather than
    // unmounted, so the strip keeps its state for the page load.
    hidden?: boolean;
    // Its own card at the far left of the strip's row, the strip beside it: the
    // Explorer menu button and mode switch on a phone, which has no room for
    // them in a corner card above the strip. Given at all (null included), the
    // strip takes the phone's row; null is that row with no menu card (a phone
    // held sideways, docs/specs/007-editor/live-app.md "A phone held sideways").
    leading?: ReactNode;
    // The screen width of Pages mode's Contents sidebar while the menu box heads it (docs/specs/007-editor/pages-mode.md
    // "Joined to the menu box"): the strip centres in what shows beside it, as a page is framed beside it.
    besideWidth?: number;
    // The active tab's elements: Search lists their element types before anything is typed.
    tabElements?: readonly Element[];
    // The tab's pages in Pages mode, whose kind is the palette's (lib/palette-kind.ts).
    tabPages?: readonly Pick<Page, 'kind'>[] | null;
    // A Participant (docs/specs/013-workspace/share-roles.md): the Participate category alone, its selection
    // modes, and no Search (it would offer every element type).
    participant?: boolean;
    // A photo page in focus (docs/specs/031-photo/photo-pages.md "The photo tools"): its tools in place of the
    // categories, their tiles and More, or (a Participant's) added at the strip's end.
    photoTools?: { node: ReactNode; inPlaceOfCategories: boolean } | null;
  };
