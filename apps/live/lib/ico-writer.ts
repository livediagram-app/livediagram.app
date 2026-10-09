// A .ico file of PNG images (docs/specs/007-editor/logo-pages.md "Export", the logo kit's
// favicon.ico): the ICONDIR header, one 16-byte ICONDIRENTRY per image, then the PNGs as they are
// (PNG-in-ICO, read by every browser and by Windows since Vista). Pure bytes; no canvas.

const HEADER_BYTES = 6;
const ENTRY_BYTES = 16;

export type IcoImage = { size: number; png: Uint8Array };

/** The .ico file holding these PNGs, smallest first as given. A side of 256 is written as 0, as
 *  the format asks. */
export function encodeIco(images: readonly IcoImage[]): Uint8Array {
  const total =
    HEADER_BYTES + images.length * ENTRY_BYTES + images.reduce((n, i) => n + i.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  let offset = HEADER_BYTES + images.length * ENTRY_BYTES;
  images.forEach((img, i) => {
    const at = HEADER_BYTES + i * ENTRY_BYTES;
    const side = img.size >= 256 ? 0 : img.size;
    out[at] = side; // width
    out[at + 1] = side; // height
    out[at + 2] = 0; // palette colours
    out[at + 3] = 0; // reserved
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, img.png.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.length;
  });
  return out;
}
