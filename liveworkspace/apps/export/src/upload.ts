// The zip's bytes into R2 as a multipart upload (liveworkspace/docs/specs/003-accounts/data-export.md "Bounded memory"):
// bytes are appended to a buffer, and each time it holds a whole part (`EXPORT_PART_BYTES`, every part but the last
// the same size, as R2 wants) that part is uploaded. What is left at the end of a chunk is kept in the object's
// storage and handed back to the next chunk's writer; the last part is the rest, whatever its size.

export type UploadedPart = { partNumber: number; etag: string };

/** The slice of an R2 multipart upload the writer uses. */
export interface PartSink {
  uploadPart(partNumber: number, value: Uint8Array): Promise<UploadedPart>;
}

export function concat(chunks: readonly Uint8Array[], length?: number): Uint8Array {
  const total = length ?? chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export class PartWriter {
  // Bytes written to the zip so far: every part uploaded and the buffer.
  offset: number;
  // The next part's number (R2 counts from 1).
  nextPart: number;
  // Parts uploaded by this writer, for the object to record.
  readonly uploaded: UploadedPart[] = [];
  private buffer: Uint8Array[];
  private buffered: number;
  private readonly sink: PartSink;
  private readonly partBytes: number;

  constructor(
    sink: PartSink,
    state: { offset: number; nextPart: number; tail: Uint8Array },
    partBytes: number,
  ) {
    this.sink = sink;
    this.partBytes = partBytes;
    this.offset = state.offset;
    this.nextPart = state.nextPart;
    this.buffer = state.tail.length > 0 ? [state.tail] : [];
    this.buffered = state.tail.length;
  }

  async append(chunks: readonly Uint8Array[]): Promise<void> {
    for (const chunk of chunks) {
      this.buffer.push(chunk);
      this.buffered += chunk.length;
      this.offset += chunk.length;
    }
    while (this.buffered >= this.partBytes) {
      const all = concat(this.buffer, this.buffered);
      await this.upload(all.subarray(0, this.partBytes));
      const rest = all.slice(this.partBytes);
      this.buffer = rest.length > 0 ? [rest] : [];
      this.buffered = rest.length;
    }
  }

  /** What is left to upload, for the object's storage between chunks. */
  tail(): Uint8Array {
    return concat(this.buffer, this.buffered);
  }

  /** Uploads the rest as the last part: also when it is empty and no part has gone yet (an upload needs one). */
  async finish(): Promise<void> {
    if (this.buffered > 0 || this.nextPart === 1) await this.upload(this.tail());
    this.buffer = [];
    this.buffered = 0;
  }

  private async upload(bytes: Uint8Array): Promise<void> {
    const part = await this.sink.uploadPart(this.nextPart, bytes);
    this.uploaded.push({ partNumber: part.partNumber, etag: part.etag });
    this.nextPart += 1;
  }
}
