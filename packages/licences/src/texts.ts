import { fileURLToPath } from 'node:url';

// A licence text a work publishes: a committed file in packages/licences/texts,
// or a file inside a package the same bundle ships.
export type TextRef =
  { label: string; file: string } | { label: string; package: string; path: string };

export type TextSource = { file: string; sources: string[]; sha256: string };

export const TEXTS_DIR = fileURLToPath(new URL('../texts/', import.meta.url));

// Every committed text, where it came from (pinned to the tag or commit the
// shipped build used) and its checksum (blueprint "Assets and external
// resources"). texts.test.ts keeps this list, the files and the tables in step.
export const TEXT_SOURCES: readonly TextSource[] = [
  {
    file: 'tensorflow-tfjs-4.22.0-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/tensorflow/tfjs/tfjs-v4.22.0/LICENSE'],
    sha256: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
  },
  {
    file: 'tensorflow-tfjs-layers-4.22.0-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/tensorflow/tfjs/tfjs-v4.22.0/tfjs-layers/LICENSE'],
    sha256: 'a79c269bc0e74de72571cea54c5f92ed74cbc6e8d1250a9fdb40357383d9dc4b',
  },
  {
    file: 'onnxruntime-1.21.0-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/microsoft/onnxruntime/v1.21.0/LICENSE'],
    sha256: '2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c',
  },
  {
    file: 'onnxruntime-89f8206ba4-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/microsoft/onnxruntime/89f8206ba4/LICENSE'],
    sha256: '2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c',
  },
  {
    file: 'onnxruntime-89f8206ba4-ThirdPartyNotices.txt',
    sources: [
      'https://raw.githubusercontent.com/microsoft/onnxruntime/89f8206ba4/ThirdPartyNotices.txt',
    ],
    sha256: 'e9e90971a8e75a9a8ac0c6412e29c1202d079998389915aa485f46c816c3b4cc',
  },
  {
    file: 'seedrandom-3.0.5-LICENSE.txt',
    sources: [
      'https://raw.githubusercontent.com/davidbau/seedrandom/3.0.5/README.md',
      'https://raw.githubusercontent.com/davidbau/seedrandom/3.0.5/lib/alea.js',
    ],
    sha256: '7c5139e697ee315479a9240cf92f626f90b1999388f8a794196feb4d9488381a',
  },
  {
    file: 'resvg-js-2.6.2-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/yisibl/resvg-js/v2.6.2/LICENSE'],
    sha256: '1f256ecad192880510e84ad60474eab7589218784b9a50bc7ceee34c2b91f1d5',
  },
  {
    file: 'xnnpack-5e8033a-LICENSE.txt',
    sources: [
      'https://raw.githubusercontent.com/google/XNNPACK/5e8033a72a8d0f1c2b1f06e29137cc697c6b661d/LICENSE',
    ],
    sha256: '63f519e15726f4c4f830bd958f694c84fecb4e0a4cacc527d2696bb71ef95ada',
  },
  {
    file: 'fp16-3c54eac-LICENSE.txt',
    sources: [
      'https://raw.githubusercontent.com/Maratyszcza/FP16/3c54eacb74f6f5e39077300c5564156c424d77ba/LICENSE',
    ],
    sha256: '17e4f539024be2749ee729d1e2f01d24cef12ece8c9bf18e91a4349be29c80bf',
  },
  {
    file: 'fxdiv-b408327-LICENSE.txt',
    sources: [
      'https://raw.githubusercontent.com/Maratyszcza/FXdiv/b408327ac2a15ec3e43352421954f5b1967701d1/LICENSE',
    ],
    sha256: '7cac00006125b1486a27e4801ed66357236e984c540bd323945ab7b66b078ec3',
  },
  {
    file: 'pthreadpool-545ebe9-LICENSE.txt',
    sources: [
      'https://raw.githubusercontent.com/Maratyszcza/pthreadpool/545ebe9f225aec6dca49109516fac02e973a3de2/LICENSE',
    ],
    sha256: '955604be43dc2c71940b5285e59ba60bd5132953ada8ca2292042817349d9399',
  },
  {
    file: 'cpuinfo-ed8b86a-LICENSE.txt',
    sources: [
      'https://raw.githubusercontent.com/pytorch/cpuinfo/ed8b86a253800bafdb7b25c5c399f91bff9cb1f3/LICENSE',
    ],
    sha256: '8e7e60636c3aa0cb03571a1a841ce5697f9551ff92b3c426c2561613d15ade70',
  },
  {
    file: 'clog-d5e37ad-LICENSE.txt',
    sources: [
      'https://raw.githubusercontent.com/pytorch/cpuinfo/d5e37adf1406cf899d7d9ec1d317c47506ccb970/LICENSE',
    ],
    sha256: '3a1fcacb580eebdadcdaa7c2041acd36e800d88dd249ea71fff1c9f116bccfd9',
  },
  {
    file: 'psimd-072586a-LICENSE.txt',
    sources: [
      'https://raw.githubusercontent.com/Maratyszcza/psimd/072586a71b55b7f8c584153d223e95687148a900/LICENSE',
    ],
    sha256: '984ce1e0b8ee89d234e28b960381f240e03a07a8031f35012f9c3256f56964e2',
  },
  {
    file: 'emscripten-3.1.28-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/emscripten-core/emscripten/3.1.28/LICENSE'],
    sha256: '51aea7641f81d560eb039bc97ce35e2517e2656fe8731eb49ce6a18498eb22fe',
  },
  {
    file: 'tiny-skia-0.10.0-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/RazrFalcon/tiny-skia/v0.10.0/LICENSE'],
    sha256: '6d41e05f1d54fe726997cb0334ec539f1dff50600b1d5d90462ec2b392770ced',
  },
  {
    file: 'inter-3.19-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/rsms/inter/v3.19/LICENSE.txt'],
    sha256: '4d7d9c95e7d7f2f0ebf76d5e0b344826b74e903a34028ee18ab54bb639e45906',
  },
  {
    file: 'lucide-1.48.0-LICENSE.txt',
    sources: ['https://unpkg.com/lucide-static@1.48.0/LICENSE'],
    sha256: 'b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57',
  },
  {
    file: 'feather-4.29.2-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/feathericons/feather/v4.29.2/LICENSE'],
    sha256: '308028e93fcf84972523cdf6e616f73168546b4953895f516d01287f16fe7bee',
  },
];
