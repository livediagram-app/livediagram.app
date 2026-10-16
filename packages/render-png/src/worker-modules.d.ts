// What wrangler hands a Worker for these imports: a `.wasm` as a compiled WebAssembly.Module, a font as raw bytes
// (the `Data` module rule).
declare module '*.wasm' {
  const mod: WebAssembly.Module;
  export default mod;
}
declare module '*.ttf' {
  const data: ArrayBuffer;
  export default data;
}
declare module '*.otf' {
  const data: ArrayBuffer;
  export default data;
}
