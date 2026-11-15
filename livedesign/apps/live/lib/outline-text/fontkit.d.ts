// fontkit ships no types; outline-font.ts types the part of it the outliner uses (FontkitFont, Fontkit).
declare module 'fontkit' {
  export function create(bytes: Uint8Array): unknown;
}
