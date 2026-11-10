import type { WebComponentShape } from '@livedocuments/document';
import { BannerFace } from '@/components/canvas/web/BannerFace';
import { CardFace } from '@/components/canvas/web/CardFace';
import { ProcessFace } from '@/components/canvas/web/ProcessFace';
import { SiteHeaderFace } from '@/components/canvas/web/SiteHeaderFace';
import { StatRowFace } from '@/components/canvas/web/StatRowFace';
import type { WebFaceProps } from '@/components/canvas/web/web-face-props';

// The web components' faces (docs/specs/009-elements/web-components-and-no-groups.md), one per kind. Each lays itself out
// from the element's size via the shared layouts in @livedocuments/document, so
// a resize re-flows the content rather than zooming it.
export function WebComponentFace({ kind, ...props }: WebFaceProps & { kind: WebComponentShape }) {
  switch (kind) {
    case 'banner':
      return <BannerFace {...props} />;
    // A callout not yet migrated draws as the badge card it becomes (docs/specs/009-elements/card.md).
    case 'callout':
    case 'card':
      return <CardFace {...props} />;
    case 'stat-row':
      return <StatRowFace {...props} />;
    case 'process':
      return <ProcessFace {...props} />;
    case 'site-header':
      return <SiteHeaderFace {...props} />;
  }
}
