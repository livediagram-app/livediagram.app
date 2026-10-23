'use client';

// A page kind's glyph (docs/specs/007-editor/pages-mode.md "Adding a page"): the one each kind wears
// wherever pages are added, the Add a Page chooser and Contents' Add Page alike.
import type { PageKind } from '@livedocuments/document';
import { lucideFileText, lucidePanelsTopLeft } from '@livedocuments/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';

const InfographicIcon = lucideGlyph(lucidePanelsTopLeft, 16);
const ArticleIcon = lucideGlyph(lucideFileText, 16);

export function PageKindGlyph({ kind }: { kind: PageKind }) {
  switch (kind) {
    case 'infographic':
      return <InfographicIcon />;
    case 'article':
      return <ArticleIcon />;
    case 'slide':
      return <SlideDeckIcon />;
  }
}
