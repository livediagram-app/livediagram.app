import { describeLicenceTables } from '@liveworkspace/licences/product-checks';

import { LICENCES } from './product.ts';

// This product's licence tables, through @liveworkspace/licences' checks: every app in apps/ is listed, the
// tables name only texts in the shared pool, each override and embedded work is sound, and each app's declared
// dependencies come out of the real install with a licence and its text. The assets are the emitted names (as
// the bundlers write them) the embedded works must cover.
describeLicenceTables(LICENCES, {
  embeddedAssets: [
    ['tfjs-backend-wasm.38dtokxvvg789.wasm', ['xnnpack', 'emscripten']],
    ['tfjs-backend-wasm-simd.3qlltfrj4oad9.wasm', ['xnnpack', 'cpuinfo', 'pthreadpool']],
    ['tfjs-backend-wasm-threaded-simd.0brfufvrco1qv.wasm', ['fp16', 'fxdiv', 'psimd', 'clog']],
    ['ort-wasm-simd-threaded.jsep.1d4fxnu9gfd3p.wasm', ['onnxruntime', 'emscripten']],
    ['webp_enc_simd.0abc.wasm', ['libwebp', 'emscripten']],
    ['webp_dec.0abc.wasm', ['libwebp']],
    ['dd4dd8881e2df4e64203b5c0ae65e1648ab55207-index_bg.wasm', ['resvg', 'tiny-skia']],
    ['7237d9cf55f177702066a28a4dde1e4c7e8ab576-Inter-Regular.ttf', ['inter']],
    ['0f3a9c2e5d71b8a4c6e2f0d9b3a7c5e1f8d2b6a4-Inter-Bold.otf', ['inter']],
  ],
});
