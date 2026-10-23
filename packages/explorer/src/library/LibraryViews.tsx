'use client';

// The Library's pages on the Explorer page: the Image Gallery and Shape Libraries, each under the pane header, drawn
// from the host's source. A host without one (an app with no gallery) says so rather than showing an empty page.

import { EmptyState } from '../ui/EmptyState';
import { ImageIcon, ShapesIcon } from '../ui/library-icons';
import { SIDEBAR_LABELS } from '../views';
import { useExplorer } from '../explorer/context';
import { PaneHeader } from '../explorer/PaneHeader';
import { useLibraryHost } from './context';
import { GalleryPane } from './GalleryPane';
import { ShapeLibrariesPane } from './ShapeLibrariesPane';
import { HelpButton } from '../explorer/HomeHero';

export function GalleryView({ onOpenNav }: { onOpenNav?: () => void }) {
  const { kind } = useExplorer();
  const { gallery } = useLibraryHost();
  return (
    <div data-explorer-view="gallery">
      <PaneHeader
        title={SIDEBAR_LABELS.gallery}
        onOpenNav={onOpenNav}
        showFilter={false}
        actions={gallery?.helpHref ? <HelpButton href={gallery.helpHref} /> : undefined}
      />
      {gallery ? (
        <GalleryPane host={gallery} kindMany={{ one: kind.lowerOne, many: kind.lowerMany }} />
      ) : (
        <EmptyState
          icon={<ImageIcon size={28} />}
          title="No Image Gallery here"
          description={`${kind.many} keep no images of their own.`}
        />
      )}
    </div>
  );
}

export function ShapeLibrariesView({ onOpenNav }: { onOpenNav?: () => void }) {
  const { kind } = useExplorer();
  const { shapeLibraries } = useLibraryHost();
  return (
    <div data-explorer-view="shape-libraries">
      <PaneHeader
        title={SIDEBAR_LABELS.shapeLibraries}
        onOpenNav={onOpenNav}
        showFilter={false}
        actions={
          shapeLibraries?.helpHref ? <HelpButton href={shapeLibraries.helpHref} /> : undefined
        }
      />
      {shapeLibraries ? (
        <ShapeLibrariesPane host={shapeLibraries} />
      ) : (
        <EmptyState
          icon={<ShapesIcon size={28} />}
          title="No Shape Libraries here"
          description={`${kind.many} keep no shape libraries.`}
        />
      )}
    </div>
  );
}
