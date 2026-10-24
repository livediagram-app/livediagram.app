// A picker's empty gallery (docs/specs/004-interface-design/empty-states.md): the image badge, "No images yet" and the
// line saying how one gets there. Shared by the Image picker's Gallery tab and a page background's Choose From My
// Images; the Gallery pane draws the page-sized EmptyState instead.
import { CompactEmptyState, lucideGlyph } from '@livedesign/ui';
import { lucideImage } from '@liveworkspace/icons/lucide';

const ImageIcon = lucideGlyph(lucideImage, 18);

// Small inside a popover (a page background's picker), regular in the Image picker's dialog.
export function GalleryEmpty({
  description,
  size = 'regular',
}: {
  description: string;
  size?: 'regular' | 'small';
}) {
  return (
    <CompactEmptyState
      size={size}
      icon={<ImageIcon />}
      title="No images yet"
      description={description}
    />
  );
}
