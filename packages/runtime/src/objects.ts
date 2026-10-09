// The object store the application talks to: image bytes and document
// snapshots. Again a structural subset of what the api worker already uses, so
// the Cloudflare runtime hands over `env.IMAGES` unchanged.

/** The HTTP metadata a writer sets and a reader reads back
 *  (apps/api/src/routes/images.ts sets `contentType` from the sniffed type). */
export type ObjectHttpMetadata = {
  contentType?: string;
  contentDisposition?: string;
  cacheControl?: string;
};

/**
 * A stored object as a reader sees it. `text()` is not decoration: the
 * thumbnail cache reads a rendered SVG back out of the store with it
 * (apps/api/src/thumbnail.ts).
 */
export type StoredObject = {
  body: ReadableStream | null;
  size?: number;
  httpMetadata?: ObjectHttpMetadata;
  customMetadata?: Record<string, string>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ObjectPutOptions = {
  httpMetadata?: ObjectHttpMetadata;
  customMetadata?: Record<string, string>;
};

export type ObjectPutValue = ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream;

export type ObjectStore = {
  put(key: string, value: ObjectPutValue, options?: ObjectPutOptions): Promise<unknown>;
  get(key: string): Promise<StoredObject | null>;
  // A single key or a batch: account deletion and retention sweeps delete
  // many keys at once (apps/api/src/db/account.ts).
  delete(key: string | string[]): Promise<void>;
};
