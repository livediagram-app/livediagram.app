'use client';

// Place Picture… (docs/specs/031-photo/photo-layers.md "Layer operations" New Layer from a picture): the image
// picker (Upload, Gallery, Search); the picture chosen lands as a new pixel layer above the active one,
// centred, scaled down to fit the photo when larger, with Free Transform on it. One edit.
import { ImagePicker } from '@/components/panels/ImagePicker';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { apiFetchImageBlob } from '@/lib/api/images';
import { placePicture } from '@/lib/photo-editor/layer-ops';
import { readPicture } from '@/lib/photo-editor/start-photo';
import { beginTransform } from '@/lib/photo-editor/tools/transform-tool';
import { track } from '@/lib/telemetry';

/** A picture's bytes placed on the photo in focus, or the reason it was not. */
export async function placeBlob(photo: PhotoEditorView, blob: Blob | null): Promise<void> {
  const s = photo.session;
  if (!s) return;
  if (!blob) return photo.toast('That picture could not be opened.');
  const read = await readPicture(blob);
  if (read.kind === 'refused') return photo.toast(read.reason);
  if (read.kind === 'psd')
    return photo.toast('A PSD opens on a new photo page: add one and drop it there.');
  placePicture(s, read.picture.raster, 'Picture');
  track('Element', 'Changed', 'PhotoLayerPlacePicture');
  if (photo.ctx) beginTransform(photo.ctx);
}

export function PlacePictureDialog({
  photo,
  onClose,
}: {
  photo: PhotoEditorView;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const scope = photo.scope;
  if (!scope) return null;
  return (
    <ImagePicker
      ownerId={scope.ownerId}
      designId={scope.designId}
      forElementId={null}
      onClose={onClose}
      onSelect={(img) => {
        onClose();
        void apiFetchImageBlob(scope.ownerId, img.id, {
          designId: scope.designId,
          shareCode: scope.shareCode,
        }).then((blob) => placeBlob(photo, blob));
      }}
    />
  );
}
