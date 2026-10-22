import type { Viewport } from 'next';

// The editor's viewport (docs/specs/007-editor/live-app.md "Mobile / responsive"): pinned at 1, because the canvas
// owns zoom. A page pinch on top of the canvas zoom zoomed the whole page instead of the canvas (tested 2026-10-03),
// and iOS focus-zoom on a sub-16px field misaligned the chrome with the canvas coordinates. Only the routes that
// draw the canvas export it (/project/<id>, /new, /embed, /embed/workbench); every other page keeps the root
// layout's zoomable viewport, so a phone can pinch to read it (WCAG 1.4.4). iOS has no focus-zoom to do on them:
// globals.css already holds every field at 16px on a phone.
export const EDITOR_VIEWPORT: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
