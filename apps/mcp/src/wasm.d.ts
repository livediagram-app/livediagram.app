// wrangler bundles a `.wasm` import as a compiled WebAssembly.Module.
declare module '*.wasm' {
  const mod: WebAssembly.Module;
  export default mod;
}
