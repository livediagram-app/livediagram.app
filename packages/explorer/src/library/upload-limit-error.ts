import type { ImageLimitRefusal } from '@liveworkspace/subscription-ui/images';

/** An upload a tier's limit refused (liveworkspace/docs/specs/006-media/media.md "With Pro on"): its message is the
 *  plain refusal, and `limit` what the server said, for the shared notice. */
export class UploadLimitError extends Error {
  readonly limit: ImageLimitRefusal;
  constructor(message: string, limit: ImageLimitRefusal) {
    super(message);
    this.name = 'UploadLimitError';
    this.limit = limit;
  }
}
