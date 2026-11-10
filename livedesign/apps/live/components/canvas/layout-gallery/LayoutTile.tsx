'use client';

// One layout in the gallery (docs/specs/007-editor/pages-mode.md "The layout gallery"): the shared
// card (LayoutCard: its hover, focus, pressed and placed states, and drawing once near view) round
// this product's preview, sized to the page's shape.
import { memo, type RefObject } from 'react';
import type { LaidOutPage } from '@livedesign/design';
import type { PageLayoutId } from '@livedesign/templates';
import { LayoutCard } from '@liveworkspace/workbench/components/canvas/layout-gallery/LayoutCard';
import { LayoutThumb } from '../layout-thumb';
import type { GalleryLayout } from './layout-gallery-filter';

// The tallest a wireframe page's tile stands: a phone, twice as tall as wide, narrows to fit
// (LayoutThumb's maxHeight) rather than towering over the row.
const WIREFRAME_TILE_MAX_H = 200;

export const LayoutTile = memo(function LayoutTile({
  layout,
  page,
  width,
  described,
  current = false,
  scrollRoot,
  onPick,
  onPreview,
}: {
  layout: GalleryLayout;
  page: LaidOutPage;
  // The preview's width in px.
  width: number;
  // Shows the one-line description under the name (a gallery with room for it).
  described: boolean;
  // The layout last placed from this gallery.
  current?: boolean;
  scrollRoot: RefObject<HTMLElement | null>;
  onPick: (id: PageLayoutId) => void;
  onPreview: (id: PageLayoutId | null) => void;
}) {
  const tall = Math.round((width * page.rect.height) / page.rect.width);
  const height = page.kind === 'wireframe' ? Math.min(tall, WIREFRAME_TILE_MAX_H) : tall;
  return (
    <LayoutCard
      id={layout.id}
      label={layout.label}
      description={layout.description}
      width={width}
      height={height}
      described={described}
      current={current}
      scrollRoot={scrollRoot}
      thumb={() => <LayoutThumb layout={layout.id} page={page} width={width} maxHeight={height} />}
      onPick={onPick}
      onPreview={onPreview}
    />
  );
});
