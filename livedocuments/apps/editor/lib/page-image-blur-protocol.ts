// What the page and the blur worker say to each other (page-image-blur.ts, page-image-blur.worker.ts).

/** Make the blurred copy of the picture at `src` for a page of `page` size, blurred by `sigma` page px. */
export type BlurCopyRequest = {
  id: number;
  src: string;
  page: { width: number; height: number };
  sigma: number;
};

/** The copy as a JPEG, or why it could not be made (the page then makes it itself). */
export type BlurCopyResponse = { id: number; blob: Blob } | { id: number; failed: string };
