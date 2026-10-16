// A blob's bytes as a `data:` URL, read by the browser's FileReader. One helper for every reader of an image's bytes:
// the api's image fetch, an import's pictures, the GIF snapshot's media and an embedded upload.
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // A data URL read always answers a string.
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('image read gave no data URL'));
    reader.onerror = () => reject(reader.error ?? new Error('image read failed'));
    reader.readAsDataURL(blob);
  });
}
