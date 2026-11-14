'use client';

// A render crash stays inside the area that threw, reported as `Error·Client·Render.<Area>.<ErrorName>`
// (docs/specs/017-telemetry/telemetry.md): the workbench's boundary, bound once to this editor's areas and telemetry.
import { createAreaErrorBoundary } from '@liveworkspace/workbench/components/primitives/AreaErrorBoundary';
import { track } from '@/lib/telemetry';

export const { AreaErrorBoundary, MenuErrorBoundary } = createAreaErrorBoundary({
  track,
  // Human names for the notice, so it reads as a place, not a component. Closed on purpose: the area is part of a
  // public telemetry token.
  labels: {
    Canvas: 'the canvas',
    Header: 'the header',
    TabBar: 'the tab bar',
    TabDialogs: 'a tab dialog',
    Collaborators: 'the collaborators panel',
    Search: 'search',
    QuickStyle: 'the quick style panel',
    Modals: 'a dialog',
    Popovers: 'a popover',
    ContextMenu: 'the menu',
    ElementDialogs: 'an element dialog',
    Tour: 'the tour',
    Menu: 'the menu',
    ExplorerSidebar: 'the sidebar',
    ExplorerPane: 'this page',
  },
});
