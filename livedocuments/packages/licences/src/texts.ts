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
    file: 'emscripten-3.1.28-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/emscripten-core/emscripten/3.1.28/LICENSE'],
    sha256: '51aea7641f81d560eb039bc97ce35e2517e2656fe8731eb49ce6a18498eb22fe',
  },
  {
    file: 'resvg-js-2.6.2-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/yisibl/resvg-js/v2.6.2/LICENSE'],
    sha256: '1f256ecad192880510e84ad60474eab7589218784b9a50bc7ceee34c2b91f1d5',
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
    file: 'lucide-1.52.0-LICENSE.txt',
    sources: ['https://unpkg.com/lucide-static@1.52.0/LICENSE'],
    sha256: 'b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57',
  },
  {
    file: 'feather-4.29.2-LICENSE.txt',
    sources: ['https://raw.githubusercontent.com/feathericons/feather/v4.29.2/LICENSE'],
    sha256: '308028e93fcf84972523cdf6e616f73168546b4953895f516d01287f16fe7bee',
  },
];
