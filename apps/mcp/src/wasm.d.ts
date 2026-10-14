// wrangler bundles a `.wasm` import as a compiled WebAssembly.Module.
declare module '*.wasm' {
  const mod: WebAssembly.Module;
  export default mod;
}

// `.ttf` imports are bundled as raw bytes via the `Data` module rule in
// wrangler.toml — used to embed a font for the resvg PNG renderer.
declare module '*.ttf' {
  const data: ArrayBuffer;
  export default data;
}
declare module '*.otf' {
  const data: ArrayBuffer;
  export default data;
}
