'use client';

// A logo page's overlays in the canvas layer (docs/specs/007-editor/logo-pages.md): its
// construction guides over the artwork. One mount in Canvas; it draws nothing when it does not apply.
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { LogoPageGuides } from './LogoPageGuides';

export function LogoCanvasOverlays({
  view,
  bare,
}: {
  view: PagesModeView;
  // Zen, presenting or the isometric view: no guides.
  bare: boolean;
}) {
  return <LogoPageGuides view={view} bare={bare} />;
}
