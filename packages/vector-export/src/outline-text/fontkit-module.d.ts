// fontkit ships no types. The package reaches it as `#fontkit` (package.json "imports"), typed by this module, so the
// type travels with the import into every app that compiles this package; outline-font.ts types the part of it the
// outliner uses (FontkitFont, Fontkit).
export declare function create(bytes: Uint8Array): unknown;
