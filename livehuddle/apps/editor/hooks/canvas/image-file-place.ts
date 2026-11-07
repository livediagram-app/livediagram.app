// A picture file handed to the canvas, pasted or dropped (docs/specs/009-elements/images.md "Paste and drop";
// docs/specs/002-project-scope/not-in-livehuddle.md "Media"): which file on the clipboard is the picture, the name a
// pasted screenshot is given, the upload through the media service (or, for a This Browser Space, the embed), and the
// image element it lands as. useClipboard runs the paste and the drop; this module holds what they share.
//
// The upload code (lib/upload-image: validation, hashing, the dimension read) is loaded only when a picture is
// actually pasted or dropped, so it stays out of the editor's first load, as the Image picker does.
import { createImage, type ImageElement } from '@livehuddle/document';

// The larger side of a placed picture, in canvas px: a sensible footprint whatever the file's resolution. The
// element keeps the file's natural size for "Reset to natural size".
export const PLACED_IMAGE_MAX_PX = 240;

export type UploadedImage = {
  id: string;
  width: number;
  height: number;
  originalName?: string;
};

/** The image element a picture lands as: its own aspect ratio, the larger side PLACED_IMAGE_MAX_PX, centred on
 *  `centre` (canvas coords), filled with the uploaded picture. */
export function placedImage(image: UploadedImage, centre: { x: number; y: number }): ImageElement {
  const ratio = image.width / image.height;
  const width =
    image.width >= image.height ? PLACED_IMAGE_MAX_PX : Math.round(PLACED_IMAGE_MAX_PX * ratio);
  const height =
    image.height >= image.width ? PLACED_IMAGE_MAX_PX : Math.round(PLACED_IMAGE_MAX_PX / ratio);
  return {
    ...createImage(centre.x - width / 2, centre.y - height / 2),
    width,
    height,
    imageId: image.id,
    naturalWidth: image.width,
    naturalHeight: image.height,
    ...(image.originalName ? { alt: image.originalName } : {}),
  };
}

/** A pasted screenshot arrives named "" or "image.png"; it gets a name the Image Gallery can tell apart. */
export function namedPastedFile(file: File, now: number = Date.now()): File {
  if (file.name && file.name !== 'image.png') return file;
  const ext = file.type.split('/')[1] || 'png';
  return new File([file], `pasted-${now}.${ext}`, { type: file.type });
}

/** The picture a paste carries: the first image file, else Safari's image item with an empty `files`. Null when it
 *  holds no picture (no file, or only files of another kind, which the canvas refuses). */
export function pastedImageFile(data: DataTransfer | null): File | null {
  if (!data) return null;
  const file = Array.from(data.files).find(isImageFile);
  if (file) return file;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const fromItem = item.getAsFile();
    if (fromItem) return fromItem;
  }
  return null;
}

/** Whether a file says it is a picture. The upload checks the bytes themselves. */
export function isImageFile(file: Pick<File, 'type'>): boolean {
  return file.type.startsWith('image/');
}

/** Whether a paste holds a file of any kind (`files`, or an item Safari lists only there). */
export function pasteHoldsFile(data: DataTransfer | null): boolean {
  if (!data) return false;
  return data.files.length > 0 || Array.from(data.items ?? []).some((i) => i.kind === 'file');
}

/** Uploads the file to the person's gallery through the media service, or embeds it in a This Browser Space
 *  (lib/upload-image `addImageFileForDocument`). Throws the upload's own readable error. */
export async function uploadImageFile(
  ownerId: string,
  documentId: string | null,
  file: File,
): Promise<UploadedImage> {
  const { addImageFileForDocument } = await import('@/lib/upload-image');
  const { image } = await addImageFileForDocument(ownerId, documentId, file);
  return {
    id: image.id,
    width: image.width,
    height: image.height,
    ...(image.originalName ? { originalName: image.originalName } : {}),
  };
}
