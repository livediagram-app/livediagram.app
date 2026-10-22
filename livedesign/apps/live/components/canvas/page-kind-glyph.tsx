'use client';

// A page kind's glyph (docs/specs/007-editor/pages-mode.md "Adding a page"): the one each kind wears
// wherever pages are added, the Add a Page chooser and Contents' Add Page alike.
import type { PageKind } from '@livedesign/document';
import { lucidePanelsTopLeft, lucideShapes } from '@livedesign/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { DeviceGlyph } from './wireframe/DeviceGlyph';

const PageIcon = lucideGlyph(lucidePanelsTopLeft, 16);
const LogoIcon = lucideGlyph(lucideShapes, 16);

export function PageKindGlyph({ kind }: { kind: PageKind | null }) {
  switch (kind) {
    case null:
      // A page whose kind is not chosen yet.
      return <PageIcon />;
    case 'logo':
      return <LogoIcon />;
    case 'wireframe':
      return <DeviceGlyph device="iphone" size={16} />;
  }
}
