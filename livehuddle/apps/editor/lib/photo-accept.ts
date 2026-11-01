import { isPhotoAcceptedType, PHOTO_ACCEPTED_TYPES } from '@livehuddle/api-schema';

// What a wall photo may be, and why one is refused (docs/specs/021-event-storming/event-storming.md Phase 8), apart
// from the detection pipeline (photo-detect.ts) so the file picker and the type check cost the editor's first load
// nothing: the pipeline, and the sticky detector in it, load only once a photo is picked.

export type PhotoDetectError =
  'photo_unsupported_heic' | 'photo_unsupported_type' | 'photo_unreadable' | 'crops_too_large';

export const PHOTO_ACCEPT_ATTR = PHOTO_ACCEPTED_TYPES.join(',');

export function photoTypeError(type: string): PhotoDetectError | null {
  if (isPhotoAcceptedType(type)) return null;
  // Called out separately because it is the single commonest rejection: HEIC
  // is the iPhone default, and "save as JPEG" is advice the author can act on
  // (docs/specs/009-elements/images.md makes the same distinction for uploads).
  if (type === 'image/heic' || type === 'image/heif') return 'photo_unsupported_heic';
  return 'photo_unsupported_type';
}
