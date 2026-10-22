'use client';

// The photo dialog open now (photo-dialog-store), for the photo page in focus: one at a time, closed
// when the page leaves focus.
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { photoDialogs, usePhotoDialog } from '@/lib/photo-editor/photo-dialog-store';
import { AdjustDialog, FilterDialog } from './PhotoApplyDialogs';
import { ColourRangeDialog, FillDialog, FlattenDialog, ModifyDialog } from './PhotoEditDialogs';
import { CanvasSizeDialog, ImageSizeDialog, RotateDialog } from './PhotoSizeDialogs';
import { PlacePictureDialog } from './PlacePictureDialog';
import { SelectAndMaskDialog } from './SelectAndMaskDialog';

const close = () => photoDialogs.close();

export function PhotoDialogs({ photo }: { photo: PhotoEditorView | undefined }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const d = usePhotoDialog();
  if (!d || !photo?.session || !photo.canEdit) return null;
  switch (d.kind) {
    case 'image-size':
      return <ImageSizeDialog photo={photo} onClose={close} />;
    case 'canvas-size':
      return <CanvasSizeDialog photo={photo} onClose={close} />;
    case 'rotate':
      return <RotateDialog photo={photo} onClose={close} />;
    case 'fill':
      return <FillDialog photo={photo} onClose={close} />;
    case 'filter':
      return <FilterDialog key={d.id} photo={photo} id={d.id} onClose={close} />;
    case 'adjust':
      return <AdjustDialog key={d.id} photo={photo} id={d.id} onClose={close} />;
    case 'colour-range':
      return <ColourRangeDialog photo={photo} onClose={close} />;
    case 'modify':
      return <ModifyDialog photo={photo} how={d.how} onClose={close} />;
    case 'flatten':
      return <FlattenDialog photo={photo} onClose={close} />;
    case 'place':
      return <PlacePictureDialog photo={photo} onClose={close} />;
    case 'select-and-mask':
      return <SelectAndMaskDialog photo={photo} onClose={close} />;
  }
}
